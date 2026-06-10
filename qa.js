/* ============================================
   QA WIDGET · SR Studio
   Self-bootstrapping comment widget.

   Config via data-* attributes on <script> tag:

   <script src="https://srosa18.github.io/qa-widget/qa.js"
           data-supabase-url="https://xxx.supabase.co"
           data-supabase-key="eyJ..."
           data-project="acme"
           data-hide-on="acme.com.br,www.acme.com.br"></script>

   Required:
     data-supabase-url    URL do Supabase do projeto
     data-supabase-key    anon/public key

   Optional:
     data-project         id do projeto (default: 'default') · usado no admin
     data-hide-on         CSV de hostnames onde o widget NÃO deve aparecer
                          (ex: domínio de produção pro cliente final)

   Desligar manualmente:
     - adicione classe "qaw-off" no <body>, ou
     - acesse com ?qa=off na URL
   ============================================ */

(function(){
  'use strict';

  // ====================================================
  // CONFIG · lê data-* attributes do próprio <script>
  // ====================================================
  var currentScript = document.currentScript || (function(){
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--){
      if (scripts[i].src && scripts[i].src.indexOf('qa.js') >= 0) return scripts[i];
    }
    return scripts[scripts.length - 1];
  })();

  var SUPABASE_URL      = currentScript ? currentScript.getAttribute('data-supabase-url') : null;
  var SUPABASE_ANON_KEY = currentScript ? currentScript.getAttribute('data-supabase-key') : null;
  var PROJECT_ID        = (currentScript ? currentScript.getAttribute('data-project') : null) || 'default';
  var HIDE_ON           = (currentScript ? currentScript.getAttribute('data-hide-on') : null) || '';
  var TABLE             = 'comments';

  var configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

  // ====================================================
  // EARLY EXIT · hostname matching + ?qa=off
  // ====================================================
  var urlOff = (location.search || '').indexOf('qa=off') >= 0;
  var host = location.hostname;
  var hideHosts = HIDE_ON.split(',').map(function(h){ return h.trim().toLowerCase(); }).filter(Boolean);
  var hostHidden = hideHosts.some(function(h){
    return host === h || host.indexOf('.'+h) === host.length - h.length - 1;
  });

  if (urlOff || hostHidden){
    // não inicializa, mas adiciona classe pra deixar evidente
    if (document.body) document.body.classList.add('qaw-off');
    return;
  }

  // ====================================================
  // HELPERS
  // ====================================================
  function ls(k, v){
    try{
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) { localStorage.removeItem(k); return; }
      localStorage.setItem(k, v);
    }catch(e){}
  }
  function el(tag, attrs, html){
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k){
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function fmtDate(iso){
    try{
      var d = new Date(iso);
      var dd = String(d.getDate()).padStart(2,'0');
      var mm = String(d.getMonth()+1).padStart(2,'0');
      var hh = String(d.getHours()).padStart(2,'0');
      var mi = String(d.getMinutes()).padStart(2,'0');
      return dd+'/'+mm+' · '+hh+':'+mi;
    }catch(e){ return ''; }
  }
  function pageKey(){
    var path = (location.pathname || '/').replace(/\/+$/,'') || '/';
    if (path === '/') return 'index';
    // remove leading slash, .html, .htm
    return path.replace(/^\//,'').replace(/\.html?$/,'') || 'index';
  }

  // ====================================================
  // SUPABASE REST
  // ====================================================
  function sbHeaders(){
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer '+SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
  }
  function sbGet(commentId){
    if (!configured) return Promise.resolve([]);
    var url = SUPABASE_URL+'/rest/v1/'+TABLE+
      '?page=eq.'+encodeURIComponent(pageKey())+
      '&element_id=eq.'+encodeURIComponent(commentId)+
      '&order=created_at.asc';
    return fetch(url, { headers: sbHeaders() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .catch(function(){ return []; });
  }
  function sbGetAll(){
    if (!configured) return Promise.resolve([]);
    var url = SUPABASE_URL+'/rest/v1/'+TABLE+
      '?page=eq.'+encodeURIComponent(pageKey())+
      '&order=created_at.desc';
    return fetch(url, { headers: sbHeaders() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .catch(function(){ return []; });
  }
  function sbPost(payload){
    if (!configured) {
      console.warn('[qa-widget] Supabase não configurado · comentário não foi salvo:', payload);
      return Promise.reject(new Error('Supabase não configurado'));
    }
    var url = SUPABASE_URL+'/rest/v1/'+TABLE;
    var h = sbHeaders();
    h['Prefer'] = 'return=representation';
    return fetch(url, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(payload)
    }).then(function(r){
      if (!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    });
  }

  // ====================================================
  // CONTADORES por element_id
  // ====================================================
  var counts = {};
  function refreshAllCounts(){
    return sbGetAll().then(function(all){
      counts = {};
      all.forEach(function(c){
        counts[c.element_id] = (counts[c.element_id]||0) + 1;
      });
      document.querySelectorAll('[data-comment-id]').forEach(function(node){
        var id = node.getAttribute('data-comment-id');
        var pin = node.querySelector(':scope > .qaw-pin');
        if (!pin) return;
        var badge = pin.querySelector('.qaw-count');
        var n = counts[id] || 0;
        badge.textContent = n;
        badge.hidden = n === 0;
      });
    });
  }

  // ====================================================
  // INJETA pins "+"
  // ====================================================
  function injectPins(){
    document.querySelectorAll('[data-comment-id]').forEach(function(node){
      if (node.querySelector(':scope > .qaw-pin')) return;
      var pin = el('button', { 'class': 'qaw-pin', 'type': 'button', 'aria-label': 'Comentar nesta dobra', 'title': 'Deixar um comentário' }, '+');
      var badge = el('span', { 'class': 'qaw-count', 'hidden': '' });
      badge.textContent = '0';
      pin.appendChild(badge);
      pin.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        openModal(node.getAttribute('data-comment-id'), node);
      });
      var cs = window.getComputedStyle(node);
      if (cs.position === 'static') node.style.position = 'relative';
      node.appendChild(pin);
    });
  }

  // ====================================================
  // MODAL
  // ====================================================
  var modalRoot = null;
  var pending = [];                  // imagens selecionadas no modal aberto
  var MAX_FILE = 5 * 1024 * 1024;    // 5MB
  var ACCEPT_RE = /^image\/(png|jpe?g|webp|gif)$/i;

  function ensureModalRoot(){
    if (modalRoot) return modalRoot;
    modalRoot = el('div', { 'class': 'qaw-modal-backdrop', 'hidden': '' });
    document.body.appendChild(modalRoot);
    modalRoot.addEventListener('click', function(e){
      if (e.target === modalRoot) closeModal();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeModal();
    });
    // Colar print (Ctrl+V) enquanto o modal está aberto
    document.addEventListener('paste', function(e){
      if (!modalRoot || modalRoot.hidden) return;
      var items = (e.clipboardData && e.clipboardData.items) || [];
      var imgs = [];
      for (var i = 0; i < items.length; i++){
        if (items[i].type && items[i].type.indexOf('image/') === 0){
          var f = items[i].getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length){ e.preventDefault(); addFiles(imgs); }
    });
    return modalRoot;
  }

  function openModal(commentId, anchorNode){
    ensureModalRoot();
    var label = anchorNode.getAttribute('data-comment-label') || commentId;
    var savedName = ls('qaw-name') || '';
    var savedEmail = ls('qaw-email') || '';

    modalRoot.innerHTML = ''+
      '<div class="qaw-modal" role="dialog" aria-modal="true" aria-label="Comentar nesta dobra">'+
      '  <div class="qaw-modal-header">'+
      '    <div>'+
      '      <div class="qaw-modal-sub">Você está comentando a dobra</div>'+
      '      <div class="qaw-fold-chip">'+escapeHtml(label)+'</div>'+
      '    </div>'+
      '    <button class="qaw-modal-close" type="button" aria-label="Fechar">×</button>'+
      '  </div>'+
      '  <div class="qaw-list-title" data-qaw-list-title>Comentários nesta dobra</div>'+
      '  <div class="qaw-comments" data-qaw-list><div class="qaw-comment-empty">Carregando comentários…</div></div>'+
      '  <div class="qaw-modal-divider"></div>'+
      '  <button type="button" class="qaw-write-btn" data-qaw-write hidden>+ Escrever novo comentário</button>'+
      '  <form class="qaw-form" data-qaw-form hidden>'+
      '    <div class="qaw-field">'+
      '      <label>Nome</label>'+
      '      <input class="qaw-input" name="name" required maxlength="80" value="'+escapeHtml(savedName)+'" placeholder="Seu nome">'+
      '    </div>'+
      '    <div class="qaw-field">'+
      '      <label>Email (opcional)</label>'+
      '      <input class="qaw-input" name="email" type="email" maxlength="120" value="'+escapeHtml(savedEmail)+'" placeholder="para retornarmos, se necessário">'+
      '    </div>'+
      '    <div class="qaw-field">'+
      '      <label>Comentário</label>'+
      '      <textarea class="qaw-textarea" name="body" required maxlength="2000" placeholder="O que você gostaria de mudar nesta dobra?"></textarea>'+
      '    </div>'+
      '    <div class="qaw-field">'+
      '      <label>Imagens (opcional)</label>'+
      '      <div class="qaw-drop" data-qaw-drop tabindex="0">'+
      '        <input type="file" data-qaw-file accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none">'+
      '        <span class="qaw-drop-hint">Arraste prints aqui, <button type="button" class="qaw-link" data-qaw-pick>escolha do computador</button> ou cole com <strong>Ctrl+V</strong></span>'+
      '      </div>'+
      '      <div class="qaw-thumbs" data-qaw-thumbs></div>'+
      '    </div>'+
      '    <div class="qaw-actions">'+
      '      <button type="button" class="qaw-btn qaw-btn-secondary" data-qaw-cancel>Cancelar</button>'+
      '      <button type="submit" class="qaw-btn qaw-btn-primary" data-qaw-submit>Enviar comentário</button>'+
      '    </div>'+
      '    <div data-qaw-status></div>'+
      '  </form>'+
      '</div>';

    modalRoot.hidden = false;
    document.body.style.overflow = 'hidden';

    modalRoot.querySelector('.qaw-modal-close').addEventListener('click', closeModal);
    modalRoot.querySelector('[data-qaw-cancel]').addEventListener('click', closeModal);

    pending = [];
    var form = modalRoot.querySelector('[data-qaw-form]');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      submitComment(commentId, form);
    });
    // Fluxo "leia antes de escrever": quem clica no botão revela o formulário
    var writeBtn = modalRoot.querySelector('[data-qaw-write]');
    writeBtn.addEventListener('click', function(){
      writeBtn.hidden = true;
      form.hidden = false;
      var nameInput = form.querySelector('[name="name"]');
      var target = (nameInput && nameInput.value) ? form.querySelector('[name="body"]') : nameInput;
      if (target) target.focus();
    });

    setupUploader();
    loadCommentsList(commentId, true);
  }

  function closeModal(){
    if (!modalRoot) return;
    modalRoot.hidden = true;
    document.body.style.overflow = '';
  }

  function loadCommentsList(commentId, initFlow){
    var list = modalRoot.querySelector('[data-qaw-list]');
    var titleEl = modalRoot.querySelector('[data-qaw-list-title]');
    var form = modalRoot.querySelector('[data-qaw-form]');
    var writeBtn = modalRoot.querySelector('[data-qaw-write]');
    if (!configured){
      list.innerHTML = '<div class="qaw-comment-empty">— Widget não configurado. Veja README do qa-widget.</div>';
      if (initFlow && form) form.hidden = false;
      return;
    }
    sbGet(commentId).then(function(rows){
      var n = (rows && rows.length) || 0;
      if (titleEl) titleEl.textContent = n ? 'Comentários nesta dobra ('+n+')' : 'Comentários nesta dobra';
      if (initFlow && form && writeBtn){
        // Dobra com comentários: lista primeiro, formulário sob demanda.
        // Dobra vazia: formulário direto (sem clique extra).
        if (n){ writeBtn.hidden = false; form.hidden = true; }
        else  { writeBtn.hidden = true;  form.hidden = false; }
      }
      if (!n){
        list.innerHTML = '<div class="qaw-comment-empty">Seja o primeiro a comentar nesta dobra.</div>';
        return;
      }
      list.innerHTML = rows.map(function(c){
        return '<div class="qaw-comment">'+
          '<div class="qaw-comment-meta"><strong>'+escapeHtml(c.author_name||'Anônimo')+'</strong><span>'+fmtDate(c.created_at)+'</span></div>'+
          '<div>'+escapeHtml(c.body||'').replace(/\n/g,'<br>')+'</div>'+
          attachmentsHtml(c.attachments)+
          '</div>';
      }).join('');
    });
  }

  // ====================================================
  // UPLOAD DE IMAGENS · bucket "qa-uploads" (público)
  // ====================================================
  function addFiles(files){
    var arr = Array.prototype.slice.call(files || []);
    arr.forEach(function(f){
      if (!ACCEPT_RE.test(f.type || '')) return;        // só imagens
      if (f.size > MAX_FILE){
        alert('A imagem "'+(f.name||'')+'" passa de 5MB e foi ignorada.');
        return;
      }
      pending.push(f);
    });
    renderThumbs();
  }

  function renderThumbs(){
    var box = modalRoot && modalRoot.querySelector('[data-qaw-thumbs]');
    if (!box) return;
    box.innerHTML = '';
    pending.forEach(function(f, idx){
      var url = URL.createObjectURL(f);
      var chip = el('div', { 'class':'qaw-thumb' });
      chip.appendChild(el('img', { 'src': url, 'alt': f.name || '' }));
      var x = el('button', { 'class':'qaw-thumb-x', 'type':'button', 'aria-label':'Remover', 'title':'Remover' }, '×');
      x.addEventListener('click', function(){ pending.splice(idx, 1); renderThumbs(); });
      chip.appendChild(x);
      box.appendChild(chip);
    });
  }

  function setupUploader(){
    var drop = modalRoot.querySelector('[data-qaw-drop]');
    var file = modalRoot.querySelector('[data-qaw-file]');
    var pick = modalRoot.querySelector('[data-qaw-pick]');
    if (!drop || !file) return;
    if (pick) pick.addEventListener('click', function(){ file.click(); });
    file.addEventListener('change', function(){ addFiles(file.files); file.value = ''; });
    ['dragenter','dragover'].forEach(function(ev){
      drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave','drop'].forEach(function(ev){
      drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function(e){
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) addFiles(dt.files);
    });
  }

  function uploadAll(){
    if (!pending.length) return Promise.resolve([]);
    return Promise.all(pending.map(sbUpload));
  }

  function sbUpload(file){
    var ext  = (file.type && file.type.split('/')[1]) || 'png';
    var base = (file.name || ('print.'+ext)).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    var rand = Math.random().toString(36).slice(2, 8);
    var path = pageKey() + '/' + PROJECT_ID + '/' + Date.now() + '-' + rand + '-' + base;
    var dest = SUPABASE_URL + '/storage/v1/object/qa-uploads/' + path;
    return fetch(dest, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    }).then(function(r){
      if (!r.ok) throw new Error('upload HTTP ' + r.status);
      return {
        url:  SUPABASE_URL + '/storage/v1/object/public/qa-uploads/' + path,
        name: file.name || base,
        size: file.size || 0,
        type: file.type || ''
      };
    });
  }

  function parseAtts(v){
    if (!v) return [];
    if (typeof v === 'string'){ try { return JSON.parse(v) || []; } catch(e){ return []; } }
    return Array.isArray(v) ? v : [];
  }

  function attachmentsHtml(atts){
    var list = parseAtts(atts);
    if (!list.length) return '';
    var items = list.map(function(a){
      var u = escapeHtml((a && a.url) || '');
      if (!u) return '';
      return '<a class="qaw-att-item" href="'+u+'" target="_blank" rel="noopener">'+
             '<img src="'+u+'" alt="'+escapeHtml((a && a.name) || 'imagem')+'" loading="lazy"></a>';
    }).join('');
    return '<div class="qaw-att">'+items+'</div>';
  }

  function submitComment(commentId, form){
    var data = new FormData(form);
    var node = document.querySelector('[data-comment-id="'+commentId+'"]');
    var label = node ? (node.getAttribute('data-comment-label') || commentId) : commentId;
    var payload = {
      page: pageKey(),
      element_id: commentId,
      element_label: label,
      author_name: (data.get('name')||'').trim(),
      author_email: (data.get('email')||'').trim() || null,
      body: (data.get('body')||'').trim()
    };
    if (!payload.author_name || !payload.body) return;

    var statusEl = form.querySelector('[data-qaw-status]');
    var submitBtn = form.querySelector('[data-qaw-submit]');
    submitBtn.disabled = true;
    statusEl.innerHTML = '<div class="qaw-status qaw-status-loading">'+(pending.length ? 'Enviando imagens…' : 'Enviando…')+'</div>';

    ls('qaw-name', payload.author_name);
    if (payload.author_email) ls('qaw-email', payload.author_email);

    uploadAll().then(function(atts){
      payload.attachments = atts;
      if (pending.length) statusEl.innerHTML = '<div class="qaw-status qaw-status-loading">Enviando…</div>';
      return sbPost(payload);
    }).then(function(){
      pending = [];
      statusEl.innerHTML = '<div class="qaw-status qaw-status-ok">Obrigado. Comentário registrado.</div>';
      form.querySelector('[name="body"]').value = '';
      var thumbs = form.querySelector('[data-qaw-thumbs]'); if (thumbs) thumbs.innerHTML = '';
      loadCommentsList(commentId);
      refreshAllCounts();
      setTimeout(function(){ closeModal(); }, 1200);
    }).catch(function(err){
      submitBtn.disabled = false;
      statusEl.innerHTML = '<div class="qaw-status qaw-status-err">Falha ao enviar. Verifique conexão. ('+escapeHtml(err.message||'erro')+')</div>';
    });
  }

  // ====================================================
  // BANNER discreto
  // ====================================================
  function injectBanner(){
    if (document.querySelector('.qaw-banner')) return;
    var banner = el('div', { 'class': 'qaw-banner' });
    var dotClass = configured ? '' : 'is-offline';
    banner.innerHTML = ''+
      '<span class="qaw-banner-dot '+dotClass+'"></span>'+
      '<span>'+(configured ? 'QA mode · clique no <strong>+</strong> nas dobras' : 'QA widget · Supabase não configurado')+'</span>';
    document.body.appendChild(banner);
  }

  // ====================================================
  // INIT
  // ====================================================
  function init(){
    if (document.body.classList.contains('qaw-off')) return;
    // injeta CSS irmão (qa.css) se ainda não foi carregado
    if (!document.querySelector('link[href*="qa.css"]') && currentScript && currentScript.src){
      var cssHref = currentScript.src.replace(/qa\.js(\?.*)?$/, 'qa.css');
      var link = el('link', { 'rel':'stylesheet', 'href': cssHref });
      document.head.appendChild(link);
    }
    injectPins();
    injectBanner();
    if (configured) refreshAllCounts();
    // observa mutações (cobre conteúdo injetado por React/Vue/Next.js dynamicamente)
    var obs = new MutationObserver(function(){ injectPins(); });
    obs.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

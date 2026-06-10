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
      '      <div class="qaw-modal-sub">'+escapeHtml(label)+'</div>'+
      '      <h3 class="qaw-modal-title">Deixe seu comentário sobre esta dobra</h3>'+
      '    </div>'+
      '    <button class="qaw-modal-close" type="button" aria-label="Fechar">×</button>'+
      '  </div>'+
      '  <div class="qaw-comments" data-qaw-list><div class="qaw-comment-empty">Carregando comentários…</div></div>'+
      '  <div class="qaw-modal-divider"></div>'+
      '  <form class="qaw-form" data-qaw-form>'+
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

    var form = modalRoot.querySelector('[data-qaw-form]');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      submitComment(commentId, form);
    });

    loadCommentsList(commentId);
  }

  function closeModal(){
    if (!modalRoot) return;
    modalRoot.hidden = true;
    document.body.style.overflow = '';
  }

  function loadCommentsList(commentId){
    var list = modalRoot.querySelector('[data-qaw-list]');
    if (!configured){
      list.innerHTML = '<div class="qaw-comment-empty">— Widget não configurado. Veja README do qa-widget.</div>';
      return;
    }
    sbGet(commentId).then(function(rows){
      if (!rows || !rows.length){
        list.innerHTML = '<div class="qaw-comment-empty">Seja o primeiro a comentar nesta dobra.</div>';
        return;
      }
      list.innerHTML = rows.map(function(c){
        return '<div class="qaw-comment">'+
          '<div class="qaw-comment-meta"><strong>'+escapeHtml(c.author_name||'Anônimo')+'</strong><span>'+fmtDate(c.created_at)+'</span></div>'+
          '<div>'+escapeHtml(c.body||'').replace(/\n/g,'<br>')+'</div>'+
          '</div>';
      }).join('');
    });
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
    statusEl.innerHTML = '<div class="qaw-status qaw-status-loading">Enviando…</div>';
    submitBtn.disabled = true;

    ls('qaw-name', payload.author_name);
    if (payload.author_email) ls('qaw-email', payload.author_email);

    sbPost(payload).then(function(){
      statusEl.innerHTML = '<div class="qaw-status qaw-status-ok">Obrigado. Comentário registrado.</div>';
      form.querySelector('[name="body"]').value = '';
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

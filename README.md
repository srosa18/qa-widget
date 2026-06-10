# QA Widget · SR Studio

Comment pins por dobra de conteúdo + admin dashboard para revisar feedback
de clientes em wireframes e sites em desenvolvimento. Drop-in via CDN —
funciona em HTML estático, Next.js, React, Vue, qualquer coisa.

**Live:**
- CDN: `https://srosa18.github.io/qa-widget/`
- Admin: `https://srosa18.github.io/qa-widget/admin.html?project=<slug>`

---

## Como funciona

1. Você inclui 1 `<script>` no head/body do site do cliente.
2. Marca seções com `data-comment-id="page.section"`.
3. Botão `+` aparece em cada dobra. Cliente clica, escreve, envia.
4. Comentário cai num Supabase próprio do cliente.
5. Você revisa tudo em `admin.html?project=<slug>` (Por autor / Por dobra / Cronológico).

Status do workflow: **Aberto → Em análise → Resolvido**, com **Descartar** (soft-delete reversível) e **Excluir definitivamente** (hard-delete só em descartados).

---

## Setup de um cliente novo · 3 passos

### 1. Supabase do cliente

Crie um projeto Supabase pro cliente (free). No SQL Editor, rode:

```sql
create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  page            text not null,
  element_id      text not null,
  element_label   text,
  author_name     text not null,
  author_email    text,
  body            text not null,
  status          text default 'open'
                  check (status in ('open','reviewing','done','wontfix')),
  priority        text default 'normal'
                  check (priority in ('low','normal','high')),
  reply_admin     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index comments_page_idx     on comments (page);
create index comments_status_idx   on comments (status);
create index comments_element_idx  on comments (page, element_id);
create index comments_created_idx  on comments (created_at desc);

create or replace function update_comments_timestamp()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger comments_updated_at
  before update on comments
  for each row execute function update_comments_timestamp();

alter table public.comments enable row level security;

create policy "Anyone can insert" on comments
  for insert to anon, authenticated with check (true);
create policy "Anyone can read" on comments
  for select to anon, authenticated using (true);
create policy "Anyone can update" on comments
  for update to anon, authenticated using (true) with check (true);
create policy "Anyone can delete" on comments
  for delete to anon, authenticated using (true);
```

Em **Settings → API**, copie o **Project URL** e a **anon/public key**.

### 2. Plugar o widget no site do cliente

#### HTML estático

```html
<script src="https://srosa18.github.io/qa-widget/qa.js"
        data-supabase-url="https://xxx.supabase.co"
        data-supabase-key="eyJ..."
        data-project="acme"
        data-hide-on="acme.com.br"></script>
```

Coloque no `<body>` (antes do `</body>`). O CSS é carregado automaticamente pelo próprio JS.

#### Next.js (app router)

Em `src/app/layout.tsx`:

```tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="stylesheet" href="https://srosa18.github.io/qa-widget/qa.css" />
      </head>
      <body>
        {children}
        <Script
          src="https://srosa18.github.io/qa-widget/qa.js"
          strategy="afterInteractive"
          data-supabase-url="https://xxx.supabase.co"
          data-supabase-key="eyJ..."
          data-project="acme"
          data-hide-on="acme.com.br"
        />
      </body>
    </html>
  );
}
```

#### React (CRA / Vite)

```jsx
useEffect(() => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://srosa18.github.io/qa-widget/qa.css';
  document.head.appendChild(link);

  const s = document.createElement('script');
  s.src = 'https://srosa18.github.io/qa-widget/qa.js';
  s.dataset.supabaseUrl = 'https://xxx.supabase.co';
  s.dataset.supabaseKey = 'eyJ...';
  s.dataset.project = 'acme';
  s.dataset.hideOn = 'acme.com.br';
  document.body.appendChild(s);
}, []);
```

### 3. Adicionar o cliente ao admin dashboard

Em `admin.js`, no topo do arquivo, adicione uma entrada em `PROJECTS`:

```js
var PROJECTS = {
  mentore: {
    label: 'Mêntore',
    url:   'https://vayaegbuptbarxnacele.supabase.co',
    key:   'eyJ...'
  },
  acme: {
    label: 'Acme',
    url:   'https://xxx.supabase.co',
    key:   'eyJ...'
  }
};
```

Commit + push. Em ~1 min você pode acessar `admin.html?project=acme`.

---

## Marcando dobras de conteúdo

Em qualquer `<section>`, `<div>`, `<article>` que você quer que seja
comentável, adicione 2 atributos:

```html
<section data-comment-id="home.hero" data-comment-label="Home · Hero">
  <!-- conteúdo -->
</section>

<section data-comment-id="home.beneficios" data-comment-label="Home · Benefícios">
  <!-- conteúdo -->
</section>
```

- **`data-comment-id`** — identificador único (slug). Convenção: `<página>.<seção>`.
- **`data-comment-label`** — texto humano mostrado no modal e no admin.

O widget injeta um botão `+` no canto superior direito de cada elemento marcado.

---

## Acessando o admin

URL: `https://srosa18.github.io/qa-widget/admin.html?project=<slug>`

Exemplo: `https://srosa18.github.io/qa-widget/admin.html?project=mentore`

Senha padrão: **`srstudio2026`** (mude em `admin.js`, constante `ADMIN_PASSWORD`).

Sem `?project=`, mostra o picker pra escolher entre os clientes do registry.

---

## Desligar o widget

3 formas, em ordem do mais temporário pro mais permanente:

1. **URL param** — adicione `?qa=off` no fim do link. O widget some.
2. **Hostname matching** — no `<script>`, adicione `data-hide-on="cliente.com,www.cliente.com"`. O widget só roda em domínios de preview (Vercel, GitHub Pages, localhost) e nunca em produção.
3. **Remover do código** — quando o site for pra produção pro cliente final.

---

## Custos

R$ 0. Free tier do Supabase:
- 500 MB DB · ~500.000 comentários
- 2 projetos ativos por organização

Se passar de 2 clientes ativos: ou upgrade pro Pro ($25/mês), ou cria uma nova organização Supabase, ou move clientes antigos pra "archived".

---

## Segurança

Modo MVP — anon key permite read/insert/update/delete via JS público. OK pra:
- Wireframe de revisão interna
- Site em desenvolvimento (preview Vercel/Netlify)
- Link compartilhado só com cliente confiável

**NÃO USE EM PRODUÇÃO PÚBLICA** sem antes:
- Trocar RLS por policies autenticadas (Supabase Auth)
- Substituir senha hardcoded por SSO / magic link
- Limitar admin a domínio específico

Pra wireframe revisado por dezenas de pessoas durante 2-3 semanas: simples e suficiente.

---

## Cheatsheet

| Eu quero… | Faço… |
|---|---|
| Adicionar cliente novo | (1) SQL no Supabase do cliente · (2) `<script>` no site · (3) entrada em `PROJECTS` no `admin.js` |
| Trocar senha do admin | Editar `ADMIN_PASSWORD` em `admin.js` |
| Trocar marca do admin | Editar `BRAND` / `BRAND_SUB` em `admin.js` |
| Desligar widget temporariamente | `?qa=off` na URL |
| Esconder widget em produção | `data-hide-on="dominio.com"` no script tag |
| Exportar comentários | Botão "Export CSV" no admin |
| Mudar visual do pin/modal | Editar `qa.css` (variáveis CSS no `:root`) |

---

## Arquivos do kit

- `qa.js` — widget (carrega `qa.css` automaticamente)
- `qa.css` — visual do widget
- `admin.html` — entry do dashboard
- `admin.js` — dashboard + registry de clientes
- `admin.css` — visual do dashboard
- `README.md` — este arquivo

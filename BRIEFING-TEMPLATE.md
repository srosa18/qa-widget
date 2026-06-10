# Briefing · Integrar QA Widget no [NOME-DO-CLIENTE]

> **Como usar este template:** copie este arquivo, renomeie pra
> `BRIEFING-<CLIENTE>.md` e substitua os campos entre colchetes pelos
> valores reais do projeto. Depois cole o conteúdo final num chat novo
> que tenha acesso ao repo do site do cliente.

## O que é

Tenho um widget de QA que coloca um botãozinho `+` em cada dobra do site.
Cliente clica, escreve um comentário, eu vejo num dashboard próprio.
Já está pronto, hospedado e configurado — só preciso plugar no [NOME-DO-CLIENTE].

- Repo do widget: https://github.com/srosa18/qa-widget
- README com toda a documentação: https://github.com/srosa18/qa-widget/blob/main/README.md
- Repo deste site ([NOME-DO-CLIENTE]): [URL-DO-REPO-DO-CLIENTE]

## O que eu quero que você faça

### 1. Leia o README do qa-widget
Pra entender o padrão de integração no stack que estou usando (Next.js,
React, Vue, HTML puro, etc).

### 2. Adicione o widget no layout/root do site
Sem substituir nada que já existe. Apenas merge cirúrgico de 3 coisas:
- Import necessário (ex: `Script` do `next/script` em Next.js)
- `<link rel="stylesheet">` pro CSS do widget no `<head>`
- Tag do widget logo antes do `</body>`

**Valores específicos pro [NOME-DO-CLIENTE] (use exatamente esses):**

```
data-supabase-url: [URL-DO-SUPABASE-DO-CLIENTE]
data-supabase-key: [ANON-KEY-DO-SUPABASE-DO-CLIENTE]
data-project:      [SLUG-DO-CLIENTE]
data-hide-on:      [DOMINIO-DE-PRODUCAO-DO-CLIENTE]
```

A `data-supabase-key` é uma chave **anon pública** — segura em JS público.

O `data-hide-on` garante que o widget só aparece em domínios de preview
(Vercel, Netlify, localhost) e some automaticamente em produção.

### 3. Sugira quais seções devem virar dobras comentáveis
Olhe meus componentes de página e me liste as principais seções/dobras que
fazem sentido o cliente comentar. Pra cada uma, proponha:

- `data-comment-id` no formato `<página>.<seção>` (slug curto, sem espaço)
- `data-comment-label` no formato `<Página> · <Seção>` (texto humano)

Exemplos:
```tsx
<section data-comment-id="home.hero" data-comment-label="Home · Hero">
<section data-comment-id="home.beneficios" data-comment-label="Home · Benefícios">
```

**Não aplique ainda** — só me proponha a lista pra eu aprovar. Quando eu
aprovar, você adiciona os atributos nos lugares certos.

## Constraints

- **Não quebre nada que já existe.** Fontes, metadata, providers,
  analytics, layout — tudo fica. Você só adiciona, nunca substitui.
- **Me mostre o diff antes de commitar.** Eu reviso, aprovo, aí você
  faz o commit + push.
- **Não toque em mais nada além do layout e dos componentes de seção
  que eu aprovar.** Configurações de build, env vars, package.json:
  tudo fica como está.
- O widget é apenas client-side. Não precisa de endpoint, env var,
  rota nova, nada além das 3 linhas no layout.

## Como vou validar

1. Você abre PR (ou commit direto se eu autorizar) com a mudança.
2. Plataforma de deploy (Vercel/Netlify) faz preview.
3. Abro o preview — devo ver o botãozinho `+` no canto superior direito
   de cada seção que recebeu `data-comment-id`.
4. Clico no `+` → modal abre → escrevo teste → envia → confirma
   "Comentário registrado".
5. Acesso `https://srosa18.github.io/qa-widget/admin.html?project=[SLUG-DO-CLIENTE]`
   (senha: `srstudio2026`) → vejo meu comentário lá.

Se tudo isso funcionar, mergeia pra main.

## Perguntas que você pode me fazer antes de começar

- Se eu quero que você marque TODAS as seções ou só as principais
- Se eu prefiro PR ou commit direto na main
- Se eu quero `data-comment-id` em componentes reutilizáveis (ex: cards
  de produto) ou só em seções de página

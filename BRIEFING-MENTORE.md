# Briefing · Integrar QA Widget no Mêntore

> Versão pré-preenchida do briefing genérico (BRIEFING-TEMPLATE.md)
> com os valores específicos do projeto Mêntore. Cole o conteúdo
> deste arquivo num chat novo que tenha acesso ao repo
> `srosa18/mentore-website`.

## O que é

Tenho um widget de QA que coloca um botãozinho `+` em cada dobra do site.
Cliente clica, escreve um comentário, eu vejo num dashboard próprio.
Já está pronto, hospedado e configurado — só preciso plugar no Mêntore.

- Repo do widget: https://github.com/srosa18/qa-widget
- README com toda a documentação: https://github.com/srosa18/qa-widget/blob/main/README.md
- Repo deste site (Mêntore): https://github.com/srosa18/mentore-website

Stack do Mêntore: Next.js 14 + TypeScript + Tailwind, deploy na Vercel
em `mentore-website.vercel.app`.

## O que eu quero que você faça

### 1. Leia o README do qa-widget
Pra entender o padrão de integração em Next.js (app router).

### 2. Adicione o widget em `src/app/layout.tsx`
Sem substituir nada que já existe. Apenas merge cirúrgico de 3 coisas:
- Import do `Script` do `next/script` (se ainda não estiver importado)
- `<link rel="stylesheet">` pro CSS do widget no `<head>`
- `<Script>` do widget logo antes do `</body>`

**Valores específicos pro Mêntore (use exatamente esses):**

```
data-supabase-url: https://vayaegbuptbarxnacele.supabase.co
data-supabase-key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZheWFlZ2J1cHRiYXJ4bmFjZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzcwMzEsImV4cCI6MjA5NjIxMzAzMX0._ubiVrB-0XM48PYB51uRhbEvr76lLNIAmlxMuiC9NWw
data-project:      mentore
data-hide-on:      mentore.com.br
```

A `data-supabase-key` é uma chave **anon pública** — segura em JS público.

O `data-hide-on` garante que o widget só aparece em domínios de preview
(Vercel, localhost) e some automaticamente em produção (mentore.com.br).

### 3. Sugira quais seções devem virar dobras comentáveis
Olhe meus componentes de página (`src/app/page.tsx` e qualquer outra rota)
e me liste as principais seções/dobras que fazem sentido o cliente comentar.
Pra cada uma, proponha:

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

- **Não quebre nada que já existe no `layout.tsx`.** Fontes, metadata,
  providers, analytics — tudo fica. Você só adiciona, nunca substitui.
- **Me mostre o diff antes de commitar.** Eu reviso, aprovo, aí você
  faz o commit + push.
- **Não toque em mais nada além do `layout.tsx` e dos componentes de
  seção que eu aprovar.** Configurações de Tailwind, env vars,
  package.json: tudo fica como está.
- O widget é apenas client-side. Não precisa de endpoint no Mêntore,
  variável de ambiente, rota nova, nada.

## Como vou validar

1. Você abre PR (ou commit direto se eu autorizar) com a mudança.
2. Vercel faz preview deploy.
3. Abro o preview Vercel — devo ver o botãozinho `+` no canto superior
   direito de cada seção que recebeu `data-comment-id`.
4. Clico no `+` → modal abre → escrevo teste → envia → confirma
   "Comentário registrado".
5. Acesso `https://srosa18.github.io/qa-widget/admin.html?project=mentore`
   (senha: `srstudio2026`) → vejo meu comentário lá.

Se tudo isso funcionar, mergeia pra main.

## Perguntas que você pode me fazer antes de começar

- Se eu quero que você marque TODAS as seções ou só as principais
- Se eu prefiro PR ou commit direto na main
- Se eu quero `data-comment-id` em componentes reutilizáveis (ex: cards
  de produto) ou só em seções de página

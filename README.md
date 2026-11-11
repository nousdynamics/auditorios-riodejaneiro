# Auditório Rio de Janeiro

Site ([auditorioriodejaneiro.com.br](https://auditorioriodejaneiro.com.br)) e painel de gestão para a locação dos auditórios da Rua São Bento, 09 — 13º e 14º andares, Centro do Rio (espaço da InterFISIO).
É a versão melhorada do one-page original, com a mesma proposta da plataforma Yevent: catálogo de salas, página própria para cada auditório, consulta de disponibilidade e um portal para a equipe editar tudo sem mexer em código.

- **Stack:** HTML renderizado no servidor + CSS + TypeScript, sem framework. Roda em **Cloudflare Workers** com **D1** (banco), **R2** (fotos enviadas pelo painel) e **Static Assets** (imagens, fontes, vídeo, CSS/JS).
- **Peso da home:** cerca de 13 KB de JS e 43 KB de CSS (minificados), com fontes subsetadas (30 KB + 55 KB) e fotos em AVIF/WebP.

## Páginas e rotas

| Rota | O que é |
| --- | --- |
| `/` | Home: hero, planejador de assentos, auditórios, vídeo, usos, pacote corporativo, consulta, localização, FAQ |
| `/auditorios` | Lista com filtro por participantes e tabela comparativa |
| `/auditorios/:slug` | Página da sala: galeria com lightbox, ficha, "Em resumo", recursos, formatos, FAQ, consulta |
| `/pacote-corporativo` | Andar completo, com planta ilustrativa interativa |
| `/politica-de-privacidade` | LGPD |
| `/admin` | Painel (salas, fotos, consultas, perguntas, configurações, usuários, auditoria) |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/llms-full.txt` | Gerados a partir do banco (sempre atualizados) |
| `POST /api/leads` | Registra a consulta do formulário (com anti-spam e limite por IP) |
| `/api/admin/*` | API do painel (sessão por cookie HttpOnly) |
| `/media/*` | Fotos do R2 com cache imutável |

## Estrutura

```text
src/
  worker/            Worker (servidor)
    index.ts         roteador
    views/           templates HTML (home, salas, sala, pacote, layout)
    seo/             JSON-LD, sitemap, robots, llms.txt
    api/             API pública (consultas) e do painel
    db/              bootstrap do schema, seed inicial, consultas SQL
    auth.ts          login, sessões, bloqueio por tentativas
    validate.ts      validação de toda entrada
  client/
    site.ts          interações do site (planejador, formulário, galeria, animações)
    admin.ts + admin/  painel (SPA em TypeScript puro)
  styles/            site.css e admin.css
  shared/            tipos e catálogos (recursos, formatos) usados nos dois lados
migrations/          schema SQL do D1
media-src/           originais das fotos (fonte da verdade)
public/              arquivos estáticos já otimizados
scripts/
  build.mjs          gera CSS/JS com hash (roda sozinho no dev e no deploy)
  optimize-media.mjs regenera imagens, ícones, OG image, vídeo e fontes
  create-admin.mjs   cria administrador pelo terminal
tests/               testes (Vitest)
```

## Rodar localmente

```bash
npm install
cp .dev.vars.example .dev.vars   # defina SETUP_TOKEN
npm run dev                      # http://localhost:8787
```

O banco local é criado sozinho na primeira requisição (schema + as 4 salas, FAQ e textos do site original).
Abra `/admin`, informe o `SETUP_TOKEN` e crie o primeiro administrador.

Outros comandos:

```bash
npm test            # testes
npm run typecheck   # tipos do worker e do navegador
npm run media       # regenera mídia a partir de media-src/ (precisa de ffmpeg e Python com fontTools)
```

## Publicar (GitHub → Cloudflare)

**Caminho recomendado: integração Git do Cloudflare (Workers Builds).**

1. No painel do Cloudflare: **Workers & Pages → Create → Import a repository** e escolha `nousdynamics/auditorios-riodejaneiro`, branch `main`.
2. Configuração de build:
   - Build command: *(vazio)*
   - Deploy command: `npx wrangler deploy`
   O `wrangler deploy` já roda `scripts/build.mjs` antes de empacotar (ver `build` no `wrangler.jsonc`).
3. No primeiro deploy, o Wrangler cria o banco D1 `auditorios-riodejaneiro-db` e o bucket R2 `auditorios-riodejaneiro-media` (as bindings não têm ID fixo de propósito). O schema é aplicado pelo próprio Worker na primeira visita.
   Se a sua conta não fizer o provisionamento automático, crie à mão e coloque o `database_id` no `wrangler.jsonc`:
   ```bash
   npx wrangler d1 create auditorios-riodejaneiro-db
   npx wrangler r2 bucket create auditorios-riodejaneiro-media
   ```
4. Segredos (Settings → Variables and Secrets do Worker, ou pelo terminal):
   ```bash
   npx wrangler secret put SETUP_TOKEN            # libera /admin/setup para criar o 1º admin
   npx wrangler secret put LEADS_WEBHOOK_URL             # webhook do n8n que recebe cada consulta (ver abaixo)
   npx wrangler secret put LEADS_WEBHOOK_SECRET          # opcional: vai no header X-Webhook-Secret
   npx wrangler secret put TRAFFIC_LEADS_WEBHOOK_SECRET  # opcional: web-secret do engine, se o formulário passar a exigir
   ```
   O repositório é público: a URL do n8n fica **só** no segredo do Cloudflare. A do Omini Traffic Engine fica no `wrangler.jsonc` (o engine trata a URL do formulário como pública; a proteção dele é o `web-secret`).
5. Domínio: em **Settings → Domains & Routes** adicione o domínio e defina a variável `SITE_URL` (ex.: `https://www.seudominio.com.br`) no `wrangler.jsonc`. Ela é usada nas URLs canônicas, no sitemap e no JSON-LD.
6. Acesse `/admin`, crie o administrador com o `SETUP_TOKEN` e depois **apague o segredo** `SETUP_TOKEN` (o setup só funciona com o banco sem usuários, mas não há motivo para deixá-lo ativo).
   Alternativa pelo terminal: `npm run admin:create -- --email voce@empresa.com.br --name "Seu Nome" --remote`.

**Alternativa:** `.github/workflows/deploy.yml` publica via GitHub Actions quando os segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` existem no repositório. Use um dos dois caminhos, não ambos. O `ci.yml` roda tipos, testes e um deploy de teste (`--dry-run`) em todo push e PR.

## Google Tag Manager

O contêiner fica na variável `GTM_ID` do `wrangler.jsonc` (hoje `GTM-5GZWSDV7`; vazio = sem GTM). Ele não carrega em `localhost`, para testes locais não contarem como visita, e, em páginas pré-renderizadas pelas Speculation Rules, só carrega quando a pessoa abre a página.

A CSP das páginas usa um nonce por resposta com `'strict-dynamic'`: tudo o que o GTM carregar (GA4, Google Ads, Meta, tags HTML personalizadas) é liberado sem precisar listar domínios, e script injetado sem o nonce continua bloqueado. Ver `siteCsp()` em `src/worker/lib/http.ts`.

## Webhooks de consultas (n8n + Omini Traffic Engine)

Cada consulta enviada pelo site é gravada no D1 (aparece em **/admin → Consultas**) e depois copiada em segundo plano, via `POST` JSON, para cada destino configurado:

| Destino | URL | Segredo |
|---|---|---|
| n8n | `LEADS_WEBHOOK_URL` | `LEADS_WEBHOOK_SECRET` no header `X-Webhook-Secret` (opcional) |
| Omini Traffic Engine | `TRAFFIC_LEADS_WEBHOOK_URL` no `wrangler.jsonc` (formulário `auditorio-rio`) | não exige; se passar a exigir, `TRAFFIC_LEADS_WEBHOOK_SECRET` vai no campo `web-secret` do corpo |

Os envios são independentes: se um falhar, o outro segue. Rodando em localhost, o engine nunca é chamado (ele posta nos grupos de WhatsApp). `GET /api/health` mostra quais destinos estão configurados (só sim/não). Em erro de rede, 5xx ou 429 o Worker tenta de novo uma vez após 3 s; em 4xx (segredo errado, formulário não cadastrado no engine) não repete e registra no log do Worker. A consulta nunca se perde porque já está no banco (dá para exportar em CSV).

Formato enviado ao n8n (plano, mesmo padrão dos leads do Yevent):

```json
{
  "type": "consulta_auditorio",
  "source": "site-auditorios-rio",
  "environment": "production | preview | local",
  "received_at": "2026-11-08T12:00:00.000Z",
  "id": "lead-…",
  "name": "Maria", "email": "maria@…", "phone": "5521999998888",
  "whatsapp_url": "https://wa.me/5521999998888",
  "space_name": "Auditório 1", "event_type": "Aula ou curso",
  "preferred_date": "2026-12-15", "guest_count": 35,
  "modality": "Por turno", "schedule": "Manhã, 4 horas",
  "message": "…", "channel": "whatsapp | email | copia | formulario",
  "utm_source": "", "utm_medium": "", "utm_campaign": "", "utm_term": "", "utm_content": "",
  "gclid": "", "fbclid": "",
  "page_url": "https://…/auditorios/auditorio-1",
  "admin_url": "https://…/admin#/consultas/lead-…",
  "site_url": "https://…"
}
```

`phone` já vem com 55 + DDD (pronto para WhatsApp/Evolution API) ou vazio. Use `environment` para ignorar testes locais e de preview no fluxo.

O Omini Traffic Engine recebe os mesmos campos, mais `web-secret` e `details` (texto livre do cliente). Nele, `message` vira um resumo da consulta, porque o template padrão do engine mostra só nome, e-mail, telefone e mensagem no grupo do WhatsApp:

```
Espaço: Auditório 1
Atividade: Aula ou curso
Data: 15/12/2026
Participantes: 35
Modalidade: Por turno
Horário: Manhã, 4 horas
Observações: Precisa de microfone
Origem: google / rio
Painel: https://…/admin#/consultas/lead-…
```

Num template personalizado do engine dá para usar qualquer campo direto (`{{space_name}}`, `{{preferred_date}}`, `{{guest_count}}`, `{{whatsapp_url}}`…).

Código: `src/worker/leads-webhook.ts`.

## Painel (/admin)

- **Salas:** criar, editar, publicar/ocultar, reordenar (arrastar ou setas), excluir. Campos: nome, slug, tipo, frase, andar, capacidade mín./máx., área, formatos de montagem com capacidade, recursos, resumo, descrição, valores (hora/turno/diária, com opção de mostrar ou manter "sob consulta"), destaque, título e descrição para o Google.
- **Fotos:** o navegador converte para WebP em duas larguras (720 e 1600 px) antes de enviar ao R2. Primeira foto = capa; texto alternativo por foto.
- **Consultas:** tudo que chega pelo formulário, com status, anotações, link de WhatsApp pronto e exportação CSV.
- **Perguntas frequentes:** home e pacote corporativo (viram FAQPage no Google).
- **Configurações:** WhatsApp, e-mail, endereço e coordenadas, textos da home, pacote corporativo, localização, redes sociais.
- **Usuários e auditoria:** papéis admin/editor, desativação, redefinição de senha e histórico de ações.

Segurança: senhas com PBKDF2-SHA256; sessão em cookie `__Host-` HttpOnly, Secure, SameSite=Strict (12 h); bloqueio após 5 tentativas por e-mail e 20 por IP em 15 min; CSRF por mesma origem + header obrigatório; CSP restritiva; uploads validados pelos bytes do arquivo.

## SEO, GEO e AEO

- HTML completo renderizado no servidor; um H1 por página; títulos e descrições únicos; canonical; Open Graph e Twitter Card com imagem 1200×630.
- JSON-LD conectado por `@id`: `Organization`, `LocalBusiness + EventVenue` (endereço, geo, recursos, capacidade), cada sala como `EventVenue/Place` (com `Offer` quando os valores são publicados), `FAQPage`, `BreadcrumbList`, `ItemList`, `Service` e `speakable`.
- Blocos de resposta direta ("Em resumo") e FAQ por sala para buscadores de IA e assistentes de voz.
- `llms.txt` e `llms-full.txt` com fatos, salas, FAQ e contatos; `robots.txt` libera explicitamente os robôs de IA e bloqueia `/admin` e `/api`.
- `sitemap.xml` com imagens e `lastmod` real das salas.

## Desempenho

- Fotos AVIF + WebP em 480/800/1152 px com `srcset`, placeholder borrado embutido e `preload` da imagem principal; vídeo de 11 s com VP9 e H.264 (~500 KB cada), carregado só quando aparece na tela e com suporte a Range (Safari/iOS).
- Fontes variáveis subsetadas, auto-hospedadas e pré-carregadas, com fallback de métricas ajustadas (menos salto de layout).
- CSS/JS com hash no nome e cache imutável; Speculation Rules pré-carregam as páginas internas ao passar o mouse.
- Animações respeitam `prefers-reduced-motion`; o vídeo não toca sozinho com economia de dados.

## Conteúdo a confirmar com a InterFISIO

Os textos e fotos vieram do site original. Estes dados não existiam lá e foram deixados para preencher no painel (o próprio painel lista as pendências por sala):

- Capacidade real de cada auditório (todas começaram com "30 a 50", que era a faixa geral do site).
- Área (m²), andar de cada sala e formatos de montagem.
- Valores (ficam "sob consulta" até serem publicados).
- Distância até o Museu do Amanhã: o site original diz "cerca de 100 metros"; pelo mapa, a Rua São Bento fica a algumas centenas de metros. Ajuste em **Configurações → Localização** se for o caso.
- CEP (o campo existe e entra no JSON-LD quando preenchido).
- A imagem da seção "O que você quer realizar" é ilustrativa (como no original) e está identificada assim na página.

import type { SiteSettings } from '../../shared/types';
import { ASSETS } from '../generated/assets';
import { type SafeHtml, html, jsonScript, raw } from '../lib/html';
import { fullAddress, icon, phoneDisplay, whatsappUrl } from './ui';

export interface PageMeta {
  title: string;
  description: string;
  /** Caminho canônico (/auditorios/auditorio-1). */
  path: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: unknown[];
  /** Tags extras no <head> (preload da imagem LCP etc.). */
  head?: SafeHtml | SafeHtml[];
  bodyClass?: string;
  /** Mensagem pronta do botão flutuante do WhatsApp nesta página (padrão: a das configurações). */
  whatsappMessage?: string;
}

export interface RenderCtx {
  base: string;
  settings: SiteSettings;
  path: string;
  /** Nonce da CSP desta resposta (vai em todo <script> executável). */
  nonce: string;
  /** Contêiner do Google Tag Manager; ausente = sem GTM. */
  gtmId?: string;
}

const NAV = [
  { href: '/auditorios', label: 'Auditórios' },
  { href: '/pacote-corporativo', label: 'Pacote corporativo' },
  { href: '/#localizacao', label: 'Como chegar' },
  { href: '/#duvidas', label: 'Dúvidas' },
];

const SPECULATION = {
  prefetch: [{ where: { and: [{ href_matches: '/*' }, { not: { href_matches: ['/admin*', '/api/*', '/media/*', '/*.xml', '/*.txt'] } }] }, eagerness: 'moderate' }],
  prerender: [{ where: { href_matches: ['/auditorios', '/auditorios/*', '/pacote-corporativo'] }, eagerness: 'moderate' }],
};

/**
 * Google Tag Manager. Mesmo snippet do contêiner (dataLayer + gtag('js')), com duas
 * diferenças: o gtm.js recebe o nonce da CSP (o GTM repassa às tags HTML personalizadas)
 * e, em páginas pré-renderizadas pelas Speculation Rules, só carrega quando a pessoa
 * abre a página — evita contar visitas que não aconteceram.
 */
function gtmHead(id: string, nonce: string): SafeHtml {
  const src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  return raw(`<link rel="preconnect" href="https://www.googletagmanager.com">
<script nonce="${nonce}">
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
(function(){
  var load = function(){
    gtag('js', new Date());
    var s = document.createElement('script');
    s.async = true;
    s.src = '${src}';
    s.nonce = '${nonce}';
    document.head.appendChild(s);
  };
  if (document.prerendering) document.addEventListener('prerenderingchange', load, { once: true });
  else load();
})();
</script>`);
}

/**
 * Símbolo da marca ("plateia em ondas", criado com o Codex): palco/tela em dourado e duas
 * fileiras da plateia em teal, que lembram as ondas da orla. A moldura usa currentColor
 * (tinta no cabeçalho, branco no rodapé escuro). Arquivos em public/brand/.
 */
export function brandMark(cls = 'brand__mark'): SafeHtml {
  return raw(
    `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect x="3" y="3" width="58" height="58" rx="12" fill="none" stroke="currentColor" stroke-width="5"/><rect x="14" y="14" width="36" height="7" rx="2" fill="#E5BB65"/><path d="M12 31C23 24 41 24 52 31V38C41 31 23 31 12 38Z" fill="#2BB3BD"/><path d="M12 44C23 37 41 37 52 44V51C41 44 23 44 12 51Z" fill="#2BB3BD"/></svg>`,
  );
}

export function layout(ctx: RenderCtx, meta: PageMeta, body: SafeHtml): SafeHtml {
  const s = ctx.settings;
  const canonical = ctx.base + meta.path;
  const image = meta.image ?? `${ctx.base}/og-image.jpg`;
  const fullTitle = meta.title;
  return html`<!doctype html>
<html lang="pt-BR" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${ctx.gtmId ? gtmHead(ctx.gtmId, ctx.nonce) : ''}
<title>${fullTitle}</title>
<meta name="description" content="${meta.description}">
<link rel="canonical" href="${canonical}">
${meta.noindex ? raw('<meta name="robots" content="noindex, follow">') : raw('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">')}
<meta name="theme-color" content="#123441">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">
<meta name="geo.region" content="BR-${s.address.state}">
<meta name="geo.placename" content="${s.address.city}">
${s.address.lat != null && s.address.lng != null ? html`<meta name="geo.position" content="${s.address.lat};${s.address.lng}"><meta name="ICBM" content="${s.address.lat}, ${s.address.lng}">` : ''}
<link rel="preload" href="/assets/fonts/hanken-grotesk-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/newsreader-var.woff2" as="font" type="font/woff2" crossorigin>
${meta.head ?? ''}
<link rel="stylesheet" href="${ASSETS.siteCss}">
<link rel="modulepreload" href="${ASSETS.siteJs}" nonce="${ctx.nonce}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="text/markdown" title="Resumo para IA (llms.txt)" href="/llms.txt">
<meta property="og:type" content="${meta.type ?? 'website'}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${s.brandName}">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${meta.description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta property="og:image:alt" content="${meta.imageAlt ?? 'Auditório para locação no Centro do Rio de Janeiro'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${fullTitle}">
<meta name="twitter:description" content="${meta.description}">
<meta name="twitter:image" content="${image}">
${(meta.jsonLd ?? []).map((d) => html`<script type="application/ld+json">${jsonScript(d)}</script>`)}
<script type="speculationrules" nonce="${ctx.nonce}">${jsonScript(SPECULATION)}</script>
<script type="module" src="${ASSETS.siteJs}" nonce="${ctx.nonce}"></script>
</head>
<body class="${meta.bodyClass ?? ''}">
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<div class="progress" aria-hidden="true"></div>
${header(ctx)}
<main id="conteudo">
${body}
</main>
${footer(ctx)}
<a class="wa-float" href="${whatsappUrl(s, meta.whatsappMessage)}" target="_blank" rel="noopener" aria-label="WhatsApp: ${phoneDisplay(s.whatsapp)}" title="WhatsApp" data-wa-float>${icon('whatsapp')}</a>
<div class="cookie-note" role="region" aria-label="Aviso de cookies" data-cookie-note hidden>
  <p>Usamos cookies para medir as visitas e o resultado dos nossos anúncios. <a href="/politica-de-privacidade">Saiba mais</a></p>
  <button class="btn btn--ink btn--sm" type="button" data-cookie-ok>Entendi</button>
</div>
</body>
</html>`;
}

function header(ctx: RenderCtx): SafeHtml {
  const s = ctx.settings;
  const current = (href: string) => (href === ctx.path || (href !== '/' && !href.includes('#') && ctx.path.startsWith(href)) ? 'page' : null);
  return html`<header class="site-header" data-header>
  <div class="site-header__inner">
    <a class="brand" href="/" aria-label="${s.brandName}: página inicial">
      ${brandMark()}
      <span class="brand__text"><span class="brand__name">${s.brandName}</span><span class="brand__line">${s.brandLine}</span></span>
    </a>
    <nav class="nav" id="site-nav" aria-label="Principal">
      <ul>
        ${NAV.map((n) => html`<li><a href="${n.href}" ${raw(current(n.href) ? 'aria-current="page"' : '')}>${n.label}</a></li>`)}
      </ul>
      <div class="nav__cta">
        <a class="btn btn--ink btn--sm" href="${ctx.path === '/' ? '' : '/'}#consulta">Agendar sala</a>
      </div>
    </nav>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
      ${icon('menu')}<span class="sr-only">Abrir menu</span>
    </button>
  </div>
</header>`;
}

function footer(ctx: RenderCtx): SafeHtml {
  const s = ctx.settings;
  const year = new Date().getFullYear();
  const socials = Object.entries(s.social).filter(([, v]) => v);
  return html`<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__brand">
      <a class="brand brand--footer" href="/">${brandMark()}<span class="brand__text"><span class="brand__name">${s.brandName}</span><span class="brand__line">${s.brandLine}</span></span></a>
      <p>Auditórios para aulas, cursos, treinamentos e reuniões no Centro do Rio de Janeiro, com locação por hora, por turno ou do andar completo.</p>
    </div>
    <div>
      <h2 class="site-footer__h">Endereço</h2>
      <address>${s.address.street}<br>${s.address.complement}<br>${s.address.neighborhood}, ${s.address.city} — ${s.address.state}</address>
    </div>
    <div>
      <h2 class="site-footer__h">Contato</h2>
      <ul class="site-footer__list">
        <li>${icon('whatsapp')}${phoneDisplay(s.whatsapp)}</li>
        ${s.openingHours ? html`<li>${icon('clock')}${s.openingHours}</li>` : ''}
        ${socials.map(([k, v]) => html`<li><a href="${v}" target="_blank" rel="noopener me">${k.charAt(0).toUpperCase() + k.slice(1)}</a></li>`)}
      </ul>
    </div>
    <div>
      <h2 class="site-footer__h">Navegue</h2>
      <ul class="site-footer__list">
        <li><a href="/auditorios">Auditórios</a></li>
        <li><a href="/pacote-corporativo">Pacote corporativo</a></li>
        <li><a href="/#consulta">Agendar sala</a></li>
        <li><a href="/politica-de-privacidade">Política de privacidade</a></li>
      </ul>
    </div>
  </div>
  <div class="site-footer__base">
    <p>© ${year} ${s.brandName}. ${fullAddress(s)}.</p>
    <p>Valores e disponibilidade sob consulta.</p>
  </div>
</footer>`;
}

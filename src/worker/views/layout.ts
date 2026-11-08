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
}

export interface RenderCtx {
  base: string;
  settings: SiteSettings;
  path: string;
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

export function brandMark(cls = 'brand__mark'): SafeHtml {
  return raw(`<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="currentColor"/><rect x="13" y="13" width="38" height="7" rx="2" fill="#E5BB65"/><g fill="#2BB3BD">${[0, 1, 2]
    .map((r) => [0, 1, 2, 3].map((c) => `<circle cx="${17 + c * 10}" cy="${31 + r * 9.5}" r="3.3"/>`).join(''))
    .join('')}</g></svg>`);
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
<link rel="modulepreload" href="${ASSETS.siteJs}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="text/markdown" title="Resumo para IA (llms.txt)" href="/llms.txt">
<meta property="og:type" content="${meta.type ?? 'website'}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${s.brandName} — Auditórios no Rio de Janeiro">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${meta.description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta property="og:image:alt" content="${meta.imageAlt ?? 'Auditório da InterFISIO no Centro do Rio de Janeiro'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${fullTitle}">
<meta name="twitter:description" content="${meta.description}">
<meta name="twitter:image" content="${image}">
${(meta.jsonLd ?? []).map((d) => html`<script type="application/ld+json">${jsonScript(d)}</script>`)}
<script type="speculationrules">${jsonScript(SPECULATION)}</script>
<script type="module" src="${ASSETS.siteJs}"></script>
</head>
<body class="${meta.bodyClass ?? ''}">
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<div class="progress" aria-hidden="true"></div>
${header(ctx)}
<main id="conteudo">
${body}
</main>
${footer(ctx)}
<a class="wa-float" href="${whatsappUrl(s)}" target="_blank" rel="noopener" aria-label="Conversar no WhatsApp: ${phoneDisplay(s.whatsapp)}" data-wa-float>
  ${icon('whatsapp')}<span>Conversar no WhatsApp</span>
</a>
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
        <a class="btn btn--ghost btn--sm" href="${whatsappUrl(s)}" target="_blank" rel="noopener">${icon('whatsapp')}WhatsApp</a>
        <a class="btn btn--ink btn--sm" href="${ctx.path === '/' ? '' : '/'}#consulta">Consultar disponibilidade</a>
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
        <li><a href="${whatsappUrl(s)}" target="_blank" rel="noopener">${icon('whatsapp')}${phoneDisplay(s.whatsapp)}</a></li>
        <li><a href="mailto:${s.email}">${icon('mail')}${s.email}</a></li>
        ${s.openingHours ? html`<li>${icon('clock')}${s.openingHours}</li>` : ''}
        ${socials.map(([k, v]) => html`<li><a href="${v}" target="_blank" rel="noopener me">${k.charAt(0).toUpperCase() + k.slice(1)}</a></li>`)}
      </ul>
    </div>
    <div>
      <h2 class="site-footer__h">Navegue</h2>
      <ul class="site-footer__list">
        <li><a href="/auditorios">Auditórios</a></li>
        <li><a href="/pacote-corporativo">Pacote corporativo</a></li>
        <li><a href="/#consulta">Consultar disponibilidade</a></li>
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

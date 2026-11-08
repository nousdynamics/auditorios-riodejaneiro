import { AMENITIES, CORPORATE_SPACE, LAYOUTS } from '../../shared/catalog';
import type { Room } from '../../shared/types';
import type { SiteData } from '../data';
import { ASSETS } from '../generated/assets';
import { type SafeHtml, html, paragraphs, raw } from '../lib/html';
import { breadcrumbs, faqPage, graph, organizationGraph, roomItemList, roomPlace, webPage } from '../seo/schema';
import { corporateBand, finalCta, floorPlan, locationSection } from './home';
import { type RenderCtx, brandMark, layout } from './layout';
import {
  absoluteImage,
  amenityList,
  breadcrumb,
  capacityText,
  consultForm,
  faqList,
  formatBRL,
  fullAddress,
  icon,
  layoutList,
  picture,
  preloadPhoto,
  priceList,
  roomCard,
  steps,
  whatsappUrl,
} from './ui';

// ---------------------------------------------------------------------------
// /auditorios
// ---------------------------------------------------------------------------

export function roomsPage(ctx: RenderCtx, data: SiteData): SafeHtml {
  const { settings: s, rooms } = data;
  const base = ctx.base;
  const title = 'Auditórios para locação no Centro do Rio de Janeiro | InterFISIO';
  const description = `Compare os ${rooms.length} auditórios da InterFISIO na Rua São Bento, Centro do Rio: capacidade, recursos e formatos. Locação por hora, turno ou andar completo.`;
  const amenityIds = [...new Set(rooms.flatMap((r) => r.amenities))];

  const body = html`
<section class="page-hero">
  ${breadcrumb([{ name: 'Início', href: '/' }, { name: 'Auditórios' }])}
  <h1 class="page-hero__title">Auditórios para locação no Centro do Rio</h1>
  <p class="page-hero__lead" data-speakable>A InterFISIO tem ${rooms.length} auditórios na ${s.address.street}, ${s.address.complement}, para ${s.stats.capacityLabel || '30 a 50'} pessoas, com datashow, tela de projeção e climatização. Locação por hora, por turno ou do andar completo.</p>
  <form class="filter" data-room-filter role="search" aria-label="Filtrar auditórios">
    <label for="filter-people">Participantes</label>
    <input id="filter-people" type="number" min="1" max="2000" inputmode="numeric" placeholder="Ex.: 40" data-filter-people>
    <p class="filter__status" data-filter-status aria-live="polite">${rooms.length} auditórios disponíveis</p>
  </form>
</section>

<section class="section rooms rooms--list" aria-label="Lista de auditórios">
  <div class="room-grid">${rooms.map((r, i) => roomCard(r, i))}</div>
  <p class="filter__empty" data-filter-empty hidden>Nenhum auditório sozinho comporta esse número de pessoas. <a href="/pacote-corporativo">Veja o pacote corporativo</a>, com três salas no mesmo andar.</p>
</section>

<section class="section compare" aria-labelledby="compare-title">
  <h2 id="compare-title" class="section__title">Comparativo</h2>
  <div class="compare__scroll" tabindex="0" role="region" aria-label="Tabela comparativa (role para o lado no celular)">
    <table class="compare__table">
      <thead>
        <tr><th scope="col">Recurso</th>${rooms.map((r) => html`<th scope="col"><a href="/auditorios/${r.slug}">${r.name}</a></th>`)}</tr>
      </thead>
      <tbody>
        <tr><th scope="row">Capacidade</th>${rooms.map((r) => html`<td>${capacityText(r)}</td>`)}</tr>
        <tr><th scope="row">Área</th>${rooms.map((r) => html`<td>${r.areaM2 ? `${r.areaM2} m²` : 'Sob consulta'}</td>`)}</tr>
        <tr><th scope="row">Andar</th>${rooms.map((r) => html`<td>${r.floor || 'Confirmar com a equipe'}</td>`)}</tr>
        ${amenityIds.map(
          (a) => html`<tr><th scope="row">${AMENITIES[a].label}</th>${rooms.map((r) =>
            r.amenities.includes(a) ? html`<td class="yes">${icon('check')}<span class="sr-only">Sim</span></td>` : html`<td class="no"><span aria-hidden="true">—</span><span class="sr-only">Não informado</span></td>`,
          )}</tr>`,
        )}
        <tr><th scope="row">Valores</th>${rooms.map((r) => html`<td>${priceSummary(r)}</td>`)}</tr>
      </tbody>
    </table>
  </div>
</section>

${corporateBand(s)}

<section class="section booking" id="consulta" aria-labelledby="consulta-title">
  <div class="booking__intro">
    <h2 id="consulta-title" class="section__title">Consulte disponibilidade</h2>
    <p class="section__lead">Escolha o auditório ou peça orientação. A equipe responde com a disponibilidade e os valores.</p>
    ${steps()}
  </div>
  <div class="booking__form">${consultForm(s, rooms)}</div>
</section>`;

  const jsonLd = graph(
    organizationGraph(base, s, rooms),
    webPage(base, '/auditorios', title, description),
    breadcrumbs(base, [
      { name: 'Início', path: '/' },
      { name: 'Auditórios', path: '/auditorios' },
    ]),
    roomItemList(base, rooms),
  );
  return layout(ctx, { title, description, path: '/auditorios', jsonLd: [jsonLd], bodyClass: 'page-rooms' }, body);
}

function priceSummary(r: Room): string {
  const list = priceList(r);
  if (!list.length) return 'Sob consulta';
  return list.map((p) => `${p.label}: ${formatBRL(p.value)}`).join(' · ');
}

// ---------------------------------------------------------------------------
// /auditorios/:slug
// ---------------------------------------------------------------------------

export function roomFaqs(r: Room, s: SiteData['settings']) {
  const amenities = r.amenities.map((a) => AMENITIES[a].label.toLowerCase());
  return [
    {
      question: `Quantas pessoas cabem no ${r.name}?`,
      answer: `O ${r.name} recebe ${capacityText(r).toLowerCase()}${Object.keys(r.layouts).length ? `, conforme o formato de montagem (${Object.keys(r.layouts).map((l) => LAYOUTS[l as keyof typeof LAYOUTS].label.toLowerCase()).join(', ')})` : ''}. Informe o número de participantes na consulta para a equipe confirmar.`,
    },
    {
      question: `Onde fica o ${r.name}?`,
      answer: `Na ${fullAddress(s)}${r.floor ? `, no ${r.floor}` : ''}, perto do ${s.stats.landmark || 'Museu do Amanhã'}.`,
    },
    {
      question: `Quais recursos o ${r.name} oferece?`,
      answer: amenities.length ? `${amenities.join(', ').replace(/, ([^,]*)$/, ' e $1')}.`.replace(/^./, (c) => c.toUpperCase()) : 'Consulte a equipe sobre os recursos disponíveis.',
    },
    {
      question: `Como alugar o ${r.name}?`,
      answer: `Preencha a consulta nesta página com data, horário e número de participantes e envie pelo WhatsApp ou por e-mail. A locação pode ser por hora ou por turno; a reserva é confirmada pela equipe.`,
    },
  ];
}

export function roomPage(ctx: RenderCtx, data: SiteData, r: Room): SafeHtml {
  const { settings: s, rooms } = data;
  const base = ctx.base;
  const path = `/auditorios/${r.slug}`;
  const title = r.seoTitle || `${r.name} para locação no Centro do Rio | ${s.brandName}`;
  const description =
    r.seoDescription ||
    `${r.name} da ${s.brandName} na ${s.address.street}, Centro do Rio: ${capacityText(r).toLowerCase()}, ${r.amenities
      .slice(0, 3)
      .map((a) => AMENITIES[a].label.toLowerCase())
      .join(', ')}. Locação por hora ou turno.`.slice(0, 160);
  const prices = priceList(r);
  const faqs = roomFaqs(r, s);
  const others = rooms.filter((o) => o.id !== r.id);
  const cover = r.photos[0];
  const sizes = '(min-width: 1100px) 680px, 94vw';

  const summary = `O ${r.name} da ${s.brandName} fica na ${s.address.street}, ${s.address.neighborhood}, ${s.address.city}, e recebe ${capacityText(r).toLowerCase()}. ${
    r.amenities.length
      ? `Tem ${r.amenities
          .filter((a) => a !== 'banheiro')
          .slice(0, 5)
          .map((a) => AMENITIES[a].label.toLowerCase())
          .join(', ')
          .replace(/, ([^,]*)$/, ' e $1')}.`
      : ''
  } Locação por hora ou por turno${prices.length ? '' : ', com valores sob consulta'}.`;

  const body = html`
<article class="room-page">
  <header class="room-page__head">
    ${breadcrumb([{ name: 'Início', href: '/' }, { name: 'Auditórios', href: '/auditorios' }, { name: r.name }])}
    <h1 class="room-page__title">${r.name}</h1>
    ${r.tagline ? html`<p class="room-page__tagline">${r.tagline}</p>` : ''}
  </header>

  <div class="room-page__grid">
    <div class="room-page__main">
      <div class="gallery" data-gallery>
        <div class="gallery__stage">
          ${r.photos.map(
            (p, i) => html`<figure class="gallery__slide ${i === 0 ? 'is-active' : ''}" data-slide="${i}" ${raw(i === 0 ? '' : 'aria-hidden="true"')}>
              <button class="gallery__zoom" type="button" data-lightbox="${i}" aria-label="Ampliar foto ${i + 1} de ${r.photos.length}">
                ${picture(p, { sizes, loading: i === 0 ? 'eager' : 'lazy', priority: i === 0 })}
                <span class="gallery__expand">${icon('expand')}</span>
              </button>
            </figure>`,
          )}
          ${r.photos.length > 1
            ? html`<button class="gallery__nav gallery__nav--prev" type="button" data-gallery-prev aria-label="Foto anterior">${icon('chevron')}</button>
              <button class="gallery__nav gallery__nav--next" type="button" data-gallery-next aria-label="Próxima foto">${icon('chevron')}</button>
              <p class="gallery__count"><span data-gallery-index>1</span> / ${r.photos.length}</p>`
            : ''}
        </div>
        ${r.photos.length > 1
          ? html`<div class="gallery__thumbs" role="tablist" aria-label="Fotos">
              ${r.photos.map(
                (p, i) => html`<button type="button" role="tab" class="gallery__thumb" data-thumb="${i}" aria-selected="${i === 0 ? 'true' : 'false'}" aria-label="Foto ${i + 1}">${picture(p, { sizes: '96px', alt: '' })}</button>`,
              )}
            </div>`
          : ''}
        <dialog class="lightbox" data-lightbox-dialog aria-label="Fotos do ${r.name}">
          <button class="lightbox__close" type="button" data-lightbox-close aria-label="Fechar">${icon('close')}</button>
          <img class="lightbox__img" alt="" data-lightbox-img>
          ${r.photos.length > 1 ? html`<button class="lightbox__nav lightbox__nav--prev" type="button" data-lightbox-prev aria-label="Foto anterior">${icon('chevron')}</button><button class="lightbox__nav lightbox__nav--next" type="button" data-lightbox-next aria-label="Próxima foto">${icon('chevron')}</button>` : ''}
          <p class="lightbox__caption" data-lightbox-caption></p>
        </dialog>
        <script type="application/json" data-gallery-data>${raw(JSON.stringify(r.photos.map((p) => ({ src: absoluteImage(p, ''), alt: p.alt }))).replace(/</g, '\\u003c'))}</script>
      </div>

      <dl class="facts">
        <div>${icon('people')}<dt>Capacidade</dt><dd>${capacityText(r)}</dd></div>
        <div>${icon('area')}<dt>Área</dt><dd>${r.areaM2 ? `${r.areaM2} m²` : 'Sob consulta'}</dd></div>
        <div>${icon('floor')}<dt>Andar</dt><dd>${r.floor || '13º ou 14º'}</dd></div>
        <div>${icon('clock')}<dt>Locação</dt><dd>Por hora ou turno</dd></div>
      </dl>

      <section class="answer" aria-labelledby="resumo-title">
        <h2 id="resumo-title" class="answer__title">Em resumo</h2>
        <p data-speakable>${summary}</p>
      </section>

      <section class="room-section" aria-labelledby="sobre-title">
        <h2 id="sobre-title">Sobre o ${r.name.toLowerCase().startsWith('audit') ? 'auditório' : 'espaço'}</h2>
        <div class="prose">${paragraphs(r.description)}</div>
      </section>

      ${r.amenities.length
        ? html`<section class="room-section" aria-labelledby="recursos-title"><h2 id="recursos-title">O que a sala oferece</h2>${amenityList(r)}</section>`
        : ''}

      ${Object.keys(r.layouts).length
        ? html`<section class="room-section" aria-labelledby="formatos-title"><h2 id="formatos-title">Formatos de montagem</h2>${layoutList(r)}</section>`
        : html`<section class="room-section" aria-labelledby="formatos-title"><h2 id="formatos-title">Formatos de montagem</h2><p class="muted">As cadeiras com prancheta podem ser organizadas em diferentes formatos. Conte a dinâmica da sua atividade na consulta.</p></section>`}

      <section class="room-section" aria-labelledby="faq-room-title">
        <h2 id="faq-room-title">Perguntas sobre o ${r.name}</h2>
        ${faqList(faqs.map((f, i) => ({ ...f, id: `rf${i}`, scope: 'home' as const, sortOrder: i, isPublished: true, createdAt: '', updatedAt: '' })), 'faq-sala')}
      </section>
    </div>

    <aside class="booking-card" aria-label="Consultar o ${r.name}">
      <div class="booking-card__inner">
        <p class="booking-card__status ${r.isAvailable ? 'is-on' : ''}">${r.isAvailable ? 'Disponível para consulta' : 'Indisponível no momento'}</p>
        ${prices.length
          ? html`<ul class="booking-card__prices">${prices.map((p) => html`<li><span>${p.label}</span><strong>${formatBRL(p.value)}</strong></li>`)}</ul>`
          : html`<p class="booking-card__price">Valores sob consulta</p><p class="booking-card__hint">Por hora, por turno ou no pacote do andar completo.</p>`}
        <ul class="booking-card__checks">
          <li>${icon('check')}${capacityText(r)}</li>
          <li>${icon('check')}Datashow e climatização</li>
          <li>${icon('check')}Copa e banheiro no andar</li>
        </ul>
        <a class="btn btn--ink btn--block" href="#consulta" data-room="${r.name}">Consultar este auditório</a>
        <a class="btn btn--ghost btn--block" href="${whatsappUrl(s, `Olá! Gostaria de consultar a locação do ${r.name} da ${s.brandName}.`)}" target="_blank" rel="noopener">${icon('whatsapp')}Perguntar no WhatsApp</a>
        <p class="booking-card__note">Sem cobrança nesta etapa. A reserva é confirmada pela equipe.</p>
      </div>
    </aside>
  </div>
</article>

<div class="mobile-bar" data-mobile-bar>
  <span><strong>${r.name}</strong>${capacityText(r)}</span>
  <a class="btn btn--gold btn--sm" href="#consulta" data-room="${r.name}">Consultar</a>
</div>

<section class="section booking" id="consulta" aria-labelledby="consulta-title">
  <div class="booking__intro">
    <h2 id="consulta-title" class="section__title">Consultar o ${r.name}</h2>
    <p class="section__lead">Informe data, horário e participantes. Você revisa a mensagem antes de enviar.</p>
    ${steps()}
  </div>
  <div class="booking__form">${consultForm(s, rooms, { preset: r.name })}</div>
</section>

${others.length
  ? html`<section class="section rooms" aria-labelledby="outros-title">
      <header class="section__head"><h2 id="outros-title" class="section__title">Outros auditórios</h2></header>
      <div class="room-grid room-grid--3">${others.map((o, i) => roomCard(o, i))}</div>
    </section>`
  : ''}

${locationSection(s)}`;

  const jsonLd = graph(
    organizationGraph(base, s, rooms),
    webPage(base, path, title, description, { mainEntity: { '@id': `${base}${path}#place` }, primaryImageOfPage: absoluteImage(cover, base) }),
    roomPlace(base, s, r),
    breadcrumbs(base, [
      { name: 'Início', path: '/' },
      { name: 'Auditórios', path: '/auditorios' },
      { name: r.name, path },
    ]),
    faqPage(base, path, faqs),
  );
  return layout(
    ctx,
    {
      title,
      description,
      path,
      image: absoluteImage(cover, base),
      imageAlt: cover?.alt,
      jsonLd: [jsonLd],
      head: cover ? preloadPhoto(cover, sizes) : undefined,
      bodyClass: 'page-room',
    },
    body,
  );
}

// ---------------------------------------------------------------------------
// /pacote-corporativo
// ---------------------------------------------------------------------------

export function corporatePage(ctx: RenderCtx, data: SiteData): SafeHtml {
  const { settings: s, rooms, faqs } = data;
  const base = ctx.base;
  const path = '/pacote-corporativo';
  const corpFaqs = faqs.filter((f) => f.scope === 'corporativo');
  const title = `Pacote corporativo: andar completo no Centro do Rio | ${s.brandName}`;
  const description =
    'Alugue o andar completo da InterFISIO no Centro do Rio: três salas/auditórios, recepção customizável com a sua marca, copa para coffee break e banheiro.';
  const cover = rooms[0]?.photos[0];

  const body = html`
<section class="page-hero page-hero--dark">
  ${breadcrumb([{ name: 'Início', href: '/' }, { name: 'Pacote corporativo' }])}
  <h1 class="page-hero__title">${s.corporate.title}</h1>
  <p class="page-hero__lead" data-speakable>${s.corporate.text}</p>
  <div class="page-hero__actions">
    <a class="btn btn--gold btn--lg" href="#consulta">Consultar o pacote corporativo ${icon('arrow')}</a>
    <a class="btn btn--on-dark btn--lg" href="${whatsappUrl(s, `Olá! Gostaria de consultar o pacote corporativo (andar completo) da ${s.brandName}.`)}" target="_blank" rel="noopener">${icon('whatsapp')}WhatsApp</a>
  </div>
</section>

<section class="section corp-detail" aria-labelledby="inclui-title">
  <div class="corp-detail__plan" data-reveal="plan">
    ${floorPlan()}
    <p class="muted">Esquema ilustrativo. A distribuição real do andar é apresentada pela equipe.</p>
  </div>
  <div class="corp-detail__copy">
    <h2 id="inclui-title" class="section__title">O que está incluído</h2>
    <ul class="corporate__facts corporate__facts--light">
      ${s.corporate.facts.map((f, i) => html`<li data-zone-link="${['salas', 'recepcao', 'copa'][i] ?? ''}" tabindex="0"><strong>${f.title}</strong><span>${f.text}</span></li>`)}
    </ul>
    <h3 class="corp-detail__sub">Para quem é</h3>
    <ul class="ticks">
      <li>${icon('check')}Convenções, treinamentos e integrações de equipe em várias salas ao mesmo tempo</li>
      <li>${icon('check')}Cursos com turmas paralelas e uma recepção para credenciamento</li>
      <li>${icon('check')}Empresas que querem receber convidados com a própria identidade visual</li>
    </ul>
  </div>
</section>

<section class="section rooms" aria-labelledby="salas-title">
  <header class="section__head">
    <h2 id="salas-title" class="section__title">Os auditórios</h2>
    <p class="section__lead">Confirme com a equipe quais salas compõem o pacote no andar escolhido.</p>
  </header>
  <div class="room-grid">${rooms.map((r, i) => roomCard(r, i))}</div>
</section>

<section class="section booking" id="consulta" aria-labelledby="consulta-title">
  <div class="booking__intro">
    <h2 id="consulta-title" class="section__title">Consultar o andar completo</h2>
    <p class="section__lead">Conte o formato do evento, a data e quantas pessoas devem participar.</p>
    ${steps()}
  </div>
  <div class="booking__form">${consultForm(s, rooms, { preset: CORPORATE_SPACE, modality: 'Pacote corporativo' })}</div>
</section>

${corpFaqs.length
  ? html`<section class="section faq-section" aria-labelledby="corp-faq-title">
      <div class="faq-section__head"><h2 id="corp-faq-title" class="section__title">Dúvidas sobre o pacote</h2></div>
      ${faqList(corpFaqs)}
    </section>`
  : ''}

${locationSection(s)}
${finalCta(s)}`;

  const jsonLd = graph(
    organizationGraph(base, s, rooms),
    webPage(base, path, title, description),
    {
      '@type': 'Service',
      '@id': `${base}${path}#service`,
      name: 'Pacote corporativo — locação do andar completo',
      serviceType: 'Locação de espaço para eventos corporativos',
      description,
      provider: { '@id': `${base}/#venue` },
      areaServed: { '@type': 'City', name: s.address.city },
      availableChannel: { '@type': 'ServiceChannel', serviceUrl: `${base}${path}#consulta`, servicePhone: `+${s.whatsapp}` },
    },
    breadcrumbs(base, [
      { name: 'Início', path: '/' },
      { name: 'Pacote corporativo', path },
    ]),
    corpFaqs.length ? faqPage(base, path, corpFaqs) : [],
  );
  return layout(ctx, { title, description, path, image: cover ? absoluteImage(cover, base) : undefined, jsonLd: [jsonLd], bodyClass: 'page-corporate' }, body);
}

// ---------------------------------------------------------------------------
// Política de privacidade, 404 e painel
// ---------------------------------------------------------------------------

export function privacyPage(ctx: RenderCtx): SafeHtml {
  const s = ctx.settings;
  const title = `Política de privacidade | ${s.brandName}`;
  const description = `Como a ${s.brandName} trata os dados enviados pelo formulário de consulta de locação de auditórios.`;
  const body = html`
<section class="page-hero">
  ${breadcrumb([{ name: 'Início', href: '/' }, { name: 'Política de privacidade' }])}
  <h1 class="page-hero__title">Política de privacidade</h1>
  <p class="page-hero__lead">Atualizada em novembro de 2026.</p>
</section>
<section class="section prose prose--page">
  <h2>Quais dados coletamos</h2>
  <p>Quando você prepara uma consulta, guardamos o que foi preenchido no formulário: nome, telefone (opcional), espaço de interesse, atividade, data, número de participantes, modalidade, horário e detalhes. Também registramos a página de origem e parâmetros de campanha (UTM), quando existirem.</p>
  <h2>Para que usamos</h2>
  <p>Exclusivamente para responder à sua consulta sobre a locação de auditórios e combinar as condições da reserva. Não vendemos nem compartilhamos seus dados para fins de publicidade.</p>
  <h2>Cookies e rastreamento</h2>
  <p>O site não usa cookies de rastreamento nem de publicidade. O mapa do Google só é carregado se você clicar em “Carregar mapa interativo”; a partir daí, valem as políticas do Google.</p>
  <h2>Por quanto tempo guardamos</h2>
  <p>As consultas ficam guardadas pelo tempo necessário ao atendimento e ao histórico comercial, e podem ser excluídas a qualquer momento a seu pedido.</p>
  <h2>Seus direitos (LGPD)</h2>
  <p>Você pode pedir acesso, correção ou exclusão dos seus dados pelo e-mail <a href="mailto:${s.email}">${s.email}</a> ou pelo WhatsApp <a href="${whatsappUrl(s)}" target="_blank" rel="noopener">${s.whatsapp.replace(/^55/, '')}</a>.</p>
  <h2>Contato</h2>
  <p>${s.brandName} — ${fullAddress(s)}.</p>
</section>`;
  return layout(ctx, { title, description, path: '/politica-de-privacidade', bodyClass: 'page-privacy' }, body);
}

export function notFoundPage(ctx: RenderCtx, rooms: Room[]): SafeHtml {
  const s = ctx.settings;
  const body = html`
<section class="page-hero not-found">
  <p class="not-found__code" aria-hidden="true">404</p>
  <h1 class="page-hero__title">Esta página não existe</h1>
  <p class="page-hero__lead">O endereço pode ter mudado. Escolha um dos auditórios abaixo ou volte para a página inicial.</p>
  <div class="page-hero__actions">
    <a class="btn btn--ink" href="/">Ir para a página inicial</a>
    <a class="btn btn--ghost" href="${whatsappUrl(s)}" target="_blank" rel="noopener">${icon('whatsapp')}Falar no WhatsApp</a>
  </div>
</section>
<section class="section rooms"><div class="room-grid">${rooms.map((r, i) => roomCard(r, i))}</div></section>`;
  return layout(ctx, { title: `Página não encontrada | ${s.brandName}`, description: 'Página não encontrada.', path: ctx.path, noindex: true }, body);
}

export function adminShell(): SafeHtml {
  return html`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#123441">
<title>Painel — Auditórios</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/hanken-grotesk-var.woff2" as="font" type="font/woff2" crossorigin>
${ASSETS.adminCss ? html`<link rel="stylesheet" href="${ASSETS.adminCss}">` : ''}
</head>
<body class="adm">
<div id="app"><p style="padding:2rem;font-family:system-ui">Carregando o painel…</p></div>
<div id="toasts" aria-live="polite"></div>
<noscript>O painel precisa de JavaScript ativado.</noscript>
${ASSETS.adminJs ? html`<script type="module" src="${ASSETS.adminJs}"></script>` : ''}
</body>
</html>`;
}

export { brandMark };

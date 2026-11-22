/**
 * Página de anúncio /rio-de-janeiro, no formato das landing pages de cidade do Yevent
 * (ex.: yevent.com.br/recife): topo com foto e chamada, salas logo abaixo em carrossel,
 * poucos diferenciais, chamada intermediária, dúvidas e o formulário curto em janela.
 * Cabeçalho e rodapé enxutos (sem menu) para a pessoa não sair da página.
 */
import type { SiteData } from '../data';
import { type SafeHtml, html } from '../lib/html';
import { breadcrumbs, faqPage, graph, organizationGraph, roomItemList, webPage } from '../seo/schema';
import { finalCta } from './home';
import { type RenderCtx, layout } from './layout';
import { consultForm, faqList, icon, landingRoomCard, picture, preloadPhoto, steps } from './ui';

export const RIO_LANDING_PATH = '/rio-de-janeiro';

const WHY = [
  {
    icon: 'pin',
    title: 'No Centro do Rio',
    text: 'Rua São Bento, 09, 13º e 14º andares, com fácil acesso por transporte público.',
  },
  {
    icon: 'projector',
    title: 'Estrutura pronta',
    text: 'Datashow, tela de projeção, climatização e cadeiras com prancheta. Copa e banheiro no andar.',
  },
  {
    icon: 'clock',
    title: 'Do seu jeito',
    text: 'Locação por hora, por turno ou do andar completo, com recepção personalizada.',
  },
  {
    icon: 'whatsapp',
    title: 'Resposta rápida',
    text: 'Envie seus dados e a equipe responde no WhatsApp com disponibilidade e valores.',
  },
];

export function rioLandingPage(ctx: RenderCtx, data: SiteData): SafeHtml {
  const { settings: s, rooms } = data;
  const base = ctx.base;
  const path = RIO_LANDING_PATH;
  const hero = rooms.find((r) => r.slug === 'auditorio-2')?.photos[0] ?? rooms[0]?.photos[0];
  const available = rooms.filter((r) => r.isAvailable).length || rooms.length;
  const capacity = s.stats.capacityLabel || '30 a 50';
  const faqs = data.faqs.filter((f) => f.scope === 'home').slice(0, 6);
  const title = 'Aluguel de auditório no Rio de Janeiro, no Centro';
  const description = `${available} auditórios para cursos, treinamentos e reuniões no Centro do Rio de Janeiro, de ${capacity} pessoas, com datashow e climatização. Agende sua sala.`;

  const body = html`
<section class="lp-hero" aria-labelledby="lp-title">
  ${hero ? html`<div class="lp-hero__bg">${picture(hero, { sizes: '100vw', loading: 'eager', priority: true })}</div>` : ''}
  <div class="lp-hero__inner">
    <div class="lp-hero__content">
      <p class="lp-hero__badge">${icon('pin')}${s.address.street}, Centro do Rio</p>
      <h1 id="lp-title" class="lp-hero__title">Aluguel de auditório no Rio de Janeiro</h1>
      <p class="lp-hero__lead" data-speakable>Salas de ${capacity} pessoas para cursos, treinamentos e reuniões no Centro do Rio. Por hora, por turno ou o andar completo.</p>
      <p class="hero__live"><span class="live-dot" aria-hidden="true"></span>${available} auditórios disponíveis no Rio de Janeiro</p>
      <div class="lp-hero__actions">
        <a class="btn btn--gold btn--lg" href="#consulta">Agendar sala ${icon('arrow')}</a>
        <a class="btn btn--on-dark btn--lg" href="#salas">Ver as salas ${icon('arrow', 'i i--down')}</a>
      </div>
    </div>
  </div>
</section>

<section class="section lp-rooms" id="salas" aria-labelledby="lp-rooms-title">
  <header class="section__head">
    <h2 id="lp-rooms-title" class="section__title">Salas disponíveis no Centro do Rio</h2>
    <p class="section__lead">Escolha o auditório e peça a disponibilidade para a sua data.</p>
  </header>
  <div class="lp-carousel" data-carousel>
    <div class="lp-carousel__track" tabindex="0" role="region" aria-label="Auditórios disponíveis">
      ${rooms.map((r, i) => landingRoomCard(r, i))}
    </div>
    <div class="lp-carousel__nav">
      <button class="lp-carousel__btn lp-carousel__btn--prev" type="button" data-dir="-1" aria-label="Sala anterior">${icon('arrow')}</button>
      <button class="lp-carousel__btn" type="button" data-dir="1" aria-label="Próxima sala">${icon('arrow')}</button>
    </div>
  </div>
</section>

<section class="section lp-why" aria-labelledby="lp-why-title">
  <header class="section__head">
    <h2 id="lp-why-title" class="section__title">Por que agendar aqui</h2>
  </header>
  <ul class="lp-why__grid">
    ${WHY.map((w) => html`<li><span class="lp-why__icon">${icon(w.icon)}</span><h3>${w.title}</h3><p>${w.text}</p></li>`)}
  </ul>
</section>

${finalCta(s)}

${faqs.length
  ? html`<section class="section faq-section" id="duvidas" aria-labelledby="lp-faq-title">
  <header class="section__head">
    <h2 id="lp-faq-title" class="section__title">Dúvidas frequentes</h2>
  </header>
  ${faqList(faqs)}
</section>`
  : ''}

<section class="section booking" id="consulta" aria-labelledby="consulta-title">
  <div class="booking__intro">
    <h2 id="consulta-title" class="section__title">Agende sua sala</h2>
    <p class="section__lead">Informe seus dados e receba no WhatsApp a disponibilidade e os valores para o seu evento.</p>
    ${steps()}
  </div>
  <div class="booking__form">${consultForm(s, rooms)}</div>
</section>`;

  const jsonLd = graph(
    organizationGraph(base, s, rooms),
    webPage(base, path, title, description),
    breadcrumbs(base, [
      { name: 'Início', path: '/' },
      { name: 'Rio de Janeiro', path },
    ]),
    roomItemList(base, rooms),
    faqs.length ? faqPage(base, path, faqs) : [],
  );

  return layout(
    ctx,
    {
      title,
      description,
      path,
      jsonLd: [jsonLd],
      head: hero ? preloadPhoto(hero, '100vw') : undefined,
      bodyClass: 'page-lp',
      minimal: true,
      // Página só para anúncio: fora do Google (não concorre com a home); anúncios funcionam normalmente
      noindex: true,
    },
    body,
  );
}

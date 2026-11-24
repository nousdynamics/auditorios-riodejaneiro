/**
 * Página de anúncio /rio-de-janeiro, no formato das landing pages de cidade do Yevent
 * (ex.: yevent.com.br/recife): topo com foto, chamada e o formulário curto já à vista
 * (nome, WhatsApp e participantes; o resto em "Adicionar detalhes"), salas logo abaixo,
 * poucos diferenciais, chamada intermediária e dúvidas. Os botões "Agendar sala" mais abaixo
 * abrem o mesmo formulário em janela, e no celular uma barra fixa traz o "Agendar sala".
 * Cabeçalho e rodapé enxutos (sem menu) para a pessoa não sair da página.
 *
 * Por que o formulário no topo: em 11/2026 só 2 de cada 8 visitas chegavam ao formulário
 * (que ficava no fim) e ninguém clicava em "Agendar sala" (medido no GTM/GA4).
 * GTM: a conversão desta página depende do caminho /rio-de-janeiro, do evento "lead_enviado"
 * e dos IDs do formulário (#consult-form, #f-name, #f-email, #f-phone) — não renomear.
 */
import type { SiteData } from '../data';
import { type SafeHtml, html } from '../lib/html';
import { breadcrumbs, faqPage, graph, organizationGraph, roomItemList, webPage } from '../seo/schema';
import { finalCta } from './home';
import { type RenderCtx, layout } from './layout';
import { consultForm, faqList, icon, landingRoomCard, picture, preloadPhoto } from './ui';

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
        <a class="btn btn--on-dark btn--lg" href="#salas">Ver as salas ${icon('arrow', 'i i--down')}</a>
      </div>
    </div>
    <div class="lp-hero__form" id="consulta" role="region" aria-labelledby="consulta-title">
      <h2 id="consulta-title" class="lp-hero__form-title">Peça a disponibilidade</h2>
      <p class="lp-hero__form-lead">Receba no WhatsApp os horários livres e os valores para o seu evento.</p>
      <div class="lp-hero__form-body">${consultForm(s, rooms, { compact: true, submitLabel: 'Receber disponibilidade no WhatsApp' })}</div>
      <p class="lp-hero__form-note">Sem cobrança nesta etapa. A reserva é confirmada pela equipe.</p>
    </div>
  </div>
</section>

<section class="section lp-rooms" id="salas" aria-labelledby="lp-rooms-title">
  <header class="section__head">
    <h2 id="lp-rooms-title" class="section__title">Salas disponíveis no Centro do Rio</h2>
    <p class="section__lead">Escolha o auditório e peça a disponibilidade para a sua data.</p>
  </header>
  <div class="lp-grid">
    ${rooms.map((r, i) => landingRoomCard(r, i))}
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

<div class="mobile-bar" data-mobile-bar data-bar-after="#consulta">
  <span><strong>Auditórios no Centro do Rio</strong>${capacity} pessoas · por hora ou turno</span>
  <a class="btn btn--gold btn--sm" href="#consulta">Agendar sala</a>
</div>`;

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

import type { Room } from '../../shared/types';
import type { SiteData } from '../data';
import { type SafeHtml, html, jsonScript, raw } from '../lib/html';
import { faqPage, graph, organizationGraph, roomItemList, roomPlace, webPage } from '../seo/schema';
import { type RenderCtx, layout } from './layout';
import { consultForm, faqList, icon, mapsEmbedUrl, mapsUrl, picture, preloadPhoto, roomCard, steps, wazeUrl } from './ui';

const HERO_SIZES = '(min-width: 1100px) 460px, (min-width: 760px) 40vw, 88vw';

/** Divide o título em palavras para a animação de entrada (o texto continua legível sem JS/CSS). */
export function splitWords(text: string): SafeHtml {
  return html`${text.split(/\s+/).map((w, i) => html`<span class="w" style="--w:${i}"><span>${w}</span></span> `)}`;
}

export function seatPlanner(rooms: Room[]): SafeHtml {
  const maxRoom = Math.max(0, ...rooms.map((r) => r.capacityMax));
  const seats = Math.max(50, Math.ceil(maxRoom / 10) * 10);
  const cols = 10;
  const rows = seats / cols;
  const data = rooms.map((r) => ({ name: r.name, slug: r.slug, min: r.capacityMin, max: r.capacityMax }));
  return html`<section class="planner" id="planejar" aria-labelledby="planner-title">
  <div class="planner__inner">
    <div class="planner__controls">
      <h2 id="planner-title" class="planner__title">Quantas pessoas vão participar?</h2>
      <p class="planner__lead">Arraste e veja quais auditórios comportam o seu encontro.</p>
      <div class="planner__count">
        <output id="planner-out" for="planner-range" aria-live="polite"><span data-planner-num>30</span><small>pessoas</small></output>
      </div>
      <label class="sr-only" for="planner-range">Número de participantes</label>
      <input class="range" id="planner-range" type="range" min="5" max="${Math.max(120, seats + 30)}" step="1" value="30" data-planner-range>
      <fieldset class="chips" data-planner-activity>
        <legend class="sr-only">Tipo de atividade</legend>
        ${['Aula ou curso', 'Oficina ou treinamento', 'Reunião ou encontro', 'Palestra ou evento'].map(
          (a, i) => html`<label class="chip"><input type="radio" name="planner-activity" value="${a}" ${raw(i === 0 ? 'checked' : '')}><span>${a}</span></label>`,
        )}
      </fieldset>
    </div>
    <div class="planner__stage">
      <div class="stage" aria-hidden="true">
        <div class="stage__screen"><span>tela</span></div>
        <div class="stage__seats" style="--cols:${cols};--rows:${rows}">
          ${Array.from({ length: seats }, (_, i) => raw(`<i style="--s:${i}"></i>`))}
        </div>
        <p class="stage__overflow" data-planner-overflow hidden></p>
      </div>
      <div class="planner__result" data-planner-result aria-live="polite"></div>
      <a class="btn btn--gold" href="#consulta" data-planner-cta><span>Agendar sala para <span data-planner-num>30</span> pessoas</span></a>
    </div>
  </div>
  <script type="application/json" id="planner-data">${jsonScript({ rooms: data })}</script>
</section>`;
}

export function homePage(ctx: RenderCtx, data: SiteData): SafeHtml {
  const { settings: s, rooms, faqs } = data;
  const base = ctx.base;
  const homeFaqs = faqs.filter((f) => f.scope === 'home');
  const heroPhoto = rooms.find((r) => r.slug === 'auditorio-2')?.photos[0] ?? rooms[0]?.photos[0];
  const second = rooms.find((r) => r.slug === 'auditorio-3')?.photos[0] ?? rooms[1]?.photos[0];
  const title = `${s.brandName} | Aluguel de auditórios no Centro`;
  const description =
    'Auditórios para cursos, treinamentos e reuniões no Centro do Rio, para 30 a 50 pessoas, com datashow e climatização. Locação por hora, turno ou andar completo.';

  const body = html`
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__copy">
    <p class="hero__kicker">${s.address.street}, ${s.address.neighborhood} do ${s.address.city === 'Rio de Janeiro' ? 'Rio' : s.address.city}</p>
    <h1 id="hero-title" class="hero__title">${splitWords(s.hero.title)}</h1>
    <p class="hero__intro" data-speakable>${s.hero.intro}</p>
    <div class="hero__actions">
      <a class="btn btn--ink btn--lg" href="#consulta" data-magnetic>Agendar sala ${icon('arrow')}</a>
      <a class="btn btn--ghost btn--lg" href="/auditorios">Ver auditórios</a>
    </div>
    <dl class="hero__facts">
      <div><dt>Locação</dt><dd>Por hora ou por turno</dd></div>
      <div><dt>Capacidade</dt><dd>${s.stats.capacityLabel || '30 a 50'} pessoas</dd></div>
      <div><dt>Estrutura</dt><dd>Datashow e climatização</dd></div>
    </dl>
  </div>
  <div class="hero__art" data-parallax-root>
    ${heroPhoto ? html`<div class="hero__photo hero__photo--main" data-parallax="0.06">${picture(heroPhoto, { sizes: HERO_SIZES, loading: 'eager', priority: true })}</div>` : ''}
    ${second ? html`<div class="hero__photo hero__photo--second" data-parallax="-0.08">${picture(second, { sizes: '(min-width: 760px) 220px, 40vw' })}</div>` : ''}
    <p class="hero__badge"><strong>${rooms.length} auditórios</strong> no 13º e no 14º andar</p>
  </div>
</section>

${seatPlanner(rooms)}

<section class="section rooms" id="auditorios" aria-labelledby="rooms-title">
  <header class="section__head">
    <h2 id="rooms-title" class="section__title">Seu encontro tem lugar</h2>
    <p class="section__lead">As salas têm cadeiras com prancheta, que podem ser organizadas em diferentes formatos, tela de projeção, climatização e datashow.</p>
  </header>
  <div class="room-grid">
    ${rooms.map((r, i) => roomCard(r, i))}
  </div>
  <p class="rooms__more"><a class="link-arrow" href="/auditorios">Comparar os auditórios lado a lado ${icon('arrow')}</a></p>
</section>

<section class="tour" aria-label="Vídeo: por dentro dos auditórios">
  <div class="tour__frame" data-reveal>
    <video class="tour__video" muted loop playsinline preload="none" poster="/assets/video/tour-poster.webp" width="960" height="540" data-autoplay-visible aria-label="Passeio pelos quatro auditórios">
      <source src="/assets/video/tour-auditorios.webm" type="video/webm">
      <source src="/assets/video/tour-auditorios.mp4" type="video/mp4">
    </video>
    <div class="tour__caption">
      <p>Por dentro dos auditórios</p>
      <button class="tour__toggle" type="button" data-video-toggle aria-pressed="false">${icon('play', 'i i--play')}${icon('pause', 'i i--pause')}<span class="sr-only">Reproduzir ou pausar o vídeo</span></button>
    </div>
  </div>
</section>

<section class="section uses" id="possibilidades" aria-labelledby="uses-title">
  <div class="uses__media" data-reveal>
    <picture class="ph">
      <source type="image/avif" srcset="/assets/img/encontro-profissional-480.avif 480w, /assets/img/encontro-profissional-800.avif 800w, /assets/img/encontro-profissional-1024.avif 1024w" sizes="(min-width: 900px) 40vw, 92vw">
      <source type="image/webp" srcset="/assets/img/encontro-profissional-480.webp 480w, /assets/img/encontro-profissional-800.webp 800w, /assets/img/encontro-profissional-1024.webp 1024w" sizes="(min-width: 900px) 40vw, 92vw">
      <img src="/assets/img/encontro-profissional-800.webp" alt="Imagem ilustrativa de profissionais trocando ideias durante um encontro de formação" width="1024" height="1536" loading="lazy" decoding="async">
    </picture>
    <span class="uses__note">Imagem ilustrativa</span>
  </div>
  <div class="uses__content">
    <h2 id="uses-title" class="section__title">O que você quer realizar aqui?</h2>
    <p class="section__lead">Conte o que está planejando. A equipe orienta sobre a sala e as condições adequadas à sua atividade.</p>
    <ul class="uses__list">
      ${s.uses.map(
        (u, i) => html`<li data-reveal style="--i:${i}">
          ${icon(['school', 'spark', 'talk'][i % 3])}
          <div><h3>${u.title}</h3><p>${u.text}</p>
          <a class="link-arrow" href="#consulta" data-activity="${['Aula ou curso', 'Oficina ou treinamento', 'Reunião ou encontro'][i] ?? 'Outra atividade'}">Agendar sala para ${u.title.toLowerCase()} ${icon('arrow')}</a></div>
        </li>`,
      )}
    </ul>
  </div>
</section>

${corporateBand(s)}

<section class="section booking" id="consulta" aria-labelledby="consulta-title">
  <div class="booking__intro">
    <h2 id="consulta-title" class="section__title">Seu encontro, seu próximo passo</h2>
    <p class="section__lead">Conte como vai ser a sua atividade e receba a resposta da equipe com disponibilidade e valores.</p>
    ${steps()}
  </div>
  <div class="booking__form">
    ${consultForm(s, rooms)}
  </div>
</section>

${locationSection(s)}

<section class="section faq-section" id="duvidas" aria-labelledby="faq-title">
  <div class="faq-section__head">
    <h2 id="faq-title" class="section__title">Bom saber antes de reservar</h2>
    <p class="section__lead">Não encontrou sua dúvida? <a href="#consulta">Envie pelo formulário</a> e a equipe responde.</p>
  </div>
  ${faqList(homeFaqs)}
</section>

${finalCta(s)}`;

  const jsonLd = graph(
    organizationGraph(base, s, rooms),
    webPage(base, '/', title, description, { primaryImageOfPage: heroPhoto ? `${base}/og-image.jpg` : undefined }),
    roomItemList(base, rooms),
    rooms.map((r) => roomPlace(base, s, r)),
    homeFaqs.length ? faqPage(base, '/', homeFaqs) : [],
  );

  return layout(
    ctx,
    {
      title,
      description,
      path: '/',
      jsonLd: [jsonLd],
      head: heroPhoto ? preloadPhoto(heroPhoto, HERO_SIZES) : undefined,
      bodyClass: 'page-home',
    },
    body,
  );
}

export function floorPlan(): SafeHtml {
  // Esquema ilustrativo do andar: 3 salas, recepção, copa e banheiro.
  return raw(`<svg class="plan" viewBox="0 0 420 300" role="img" aria-labelledby="plan-t plan-d">
  <title id="plan-t">Esquema ilustrativo do andar no pacote corporativo</title>
  <desc id="plan-d">Três salas ou auditórios, uma recepção customizável, copa para coffee break e banheiro no mesmo andar.</desc>
  <g class="plan__walls"><path d="M10 10h400v280H10z"/><path d="M150 10v170M280 10v170M10 180h400M300 180v110M360 180v110M150 180v40"/></g>
  <g class="plan__zone" data-zone="salas"><rect x="16" y="16" width="128" height="158"/><rect x="156" y="16" width="118" height="158"/><rect x="286" y="16" width="118" height="158"/></g>
  <g class="plan__zone" data-zone="recepcao"><rect x="16" y="186" width="278" height="98"/></g>
  <g class="plan__zone" data-zone="copa"><rect x="306" y="186" width="48" height="98"/><rect x="366" y="186" width="38" height="98"/></g>
  <g class="plan__seats">${[0, 1, 2]
    .map((k) => {
      const x0 = [30, 168, 298][k];
      let dots = '';
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) dots += `<circle cx="${x0 + c * 20}" cy="${66 + r * 20}" r="4"/>`;
      return `${dots}<rect x="${x0 - 4}" y="30" width="${88}" height="6" rx="2" class="plan__screen"/>`;
    })
    .join('')}</g>
  <g class="plan__labels"><text x="80" y="164">Sala 1</text><text x="215" y="164">Sala 2</text><text x="345" y="164">Sala 3</text><text x="155" y="240">Recepção</text><text x="330" y="276">Copa</text><text x="385" y="276">WC</text></g>
</svg>`);
}

export function corporateBand(s: RenderCtx['settings']): SafeHtml {
  const zones = ['salas', 'recepcao', 'copa'];
  return html`<section class="corporate" id="corporativo" aria-labelledby="corp-title">
  <div class="corporate__inner">
    <div class="corporate__copy">
      <p class="corporate__kicker">Pacote corporativo</p>
      <h2 id="corp-title" class="section__title">${s.corporate.title}</h2>
      <p class="corporate__text">${s.corporate.text}</p>
      <ul class="corporate__facts">
        ${s.corporate.facts.map((f, i) => html`<li data-zone-link="${zones[i] ?? ''}" tabindex="0"><strong>${f.title}</strong><span>${f.text}</span></li>`)}
      </ul>
      <div class="corporate__actions">
        <a class="btn btn--gold" href="/pacote-corporativo">Conhecer o pacote corporativo ${icon('arrow')}</a>
        <a class="btn btn--on-dark" href="#consulta" data-room="Andar completo — pacote corporativo">Agendar o andar completo</a>
      </div>
    </div>
    <figure class="corporate__plan" data-reveal="plan">
      ${floorPlan()}
      <figcaption>Esquema ilustrativo. A distribuição real é apresentada pela equipe.</figcaption>
    </figure>
  </div>
</section>`;
}

export function locationSection(s: RenderCtx['settings']): SafeHtml {
  return html`<section class="section location" id="localizacao" aria-labelledby="loc-title">
  <div class="location__copy">
    <h2 id="loc-title" class="section__title">${s.location.title}</h2>
    <p class="section__lead">${s.location.text}</p>
    <address class="location__address" data-speakable>
      <strong>${s.address.street}</strong>
      <span>${s.address.complement}</span>
      <span>${s.address.neighborhood}, ${s.address.city} — ${s.address.state}</span>
    </address>
    <ul class="location__notes">
      ${s.location.notes.map((n) => html`<li>${icon('pin')}<div><strong>${n.title}</strong><span>${n.text}</span></div></li>`)}
    </ul>
    <div class="location__actions">
      <a class="btn btn--ink" href="${mapsUrl(s)}" target="_blank" rel="noopener">${icon('pin')}Abrir no Google Maps</a>
      <a class="btn btn--ghost" href="${wazeUrl(s)}" target="_blank" rel="noopener">Ir com o Waze ${icon('external')}</a>
    </div>
    <p class="location__hint">Confirme com a equipe em qual andar será a sua atividade.</p>
  </div>
  <div class="map" data-map="${mapsEmbedUrl(s)}">
    ${raw(`<svg class="map__art" viewBox="0 0 400 320" aria-hidden="true">
      <rect width="400" height="320" class="map__bg"/>
      <path class="map__water" d="M0 0h400v54c-60 18-120 10-170 26S110 110 0 96z"/>
      <g class="map__streets"><path d="M-10 150 410 120M-10 220 410 200M60 330 120 60M190 330 220 70M300 330 330 80M-10 280 410 270"/><path class="map__main" d="M250 330 268 60"/></g>
      <g class="map__poi"><rect x="110" y="62" width="90" height="22" rx="11"/><text x="155" y="77">Museu do Amanhã</text></g>
      <g class="map__pin" transform="translate(262 168)"><circle r="26" class="map__pulse"/><path d="M0 12s-12-10-12-20a12 12 0 0 1 24 0c0 10-12 20-12 20z"/><circle cy="-8" r="4.5" class="map__dot"/></g>
    </svg>`)}
    <button class="map__load btn btn--light" type="button" data-map-load>${icon('pin')}Carregar mapa interativo</button>
    <p class="map__note">O mapa do Google só é carregado se você clicar.</p>
  </div>
</section>`;
}

export function finalCta(s: RenderCtx['settings']): SafeHtml {
  return html`<section class="final-cta" aria-labelledby="final-title">
  <div class="final-cta__inner" data-reveal>
    <h2 id="final-title">Conte o que você está planejando</h2>
    <p>Data, horário e número de pessoas bastam para começar. A equipe confirma a sala e as condições.</p>
    <div class="final-cta__actions">
      <a class="btn btn--gold btn--lg" href="#consulta">Agendar sala ${icon('arrow')}</a>
    </div>
  </div>
</section>`;
}

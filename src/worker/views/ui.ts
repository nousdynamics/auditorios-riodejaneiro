import { ACTIVITIES, AMENITIES, CORPORATE_SPACE, GUIDANCE_SPACE, LAYOUTS, MODALITIES } from '../../shared/catalog';
import type { Faq, Photo, Room, SiteSettings } from '../../shared/types';
import { type SafeHtml, html, raw } from '../lib/html';
import lqip from '../lqip.json';

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function capacityText(r: Pick<Room, 'capacityMin' | 'capacityMax'>): string {
  if (r.capacityMin && r.capacityMin < r.capacityMax) return `${r.capacityMin} a ${r.capacityMax} pessoas`;
  return `Até ${r.capacityMax} pessoas`;
}

/**
 * Mensagem pronta do WhatsApp na página de uma sala, ex.:
 * "Olá! Quero o Auditório 1, para 30 a 50 pessoas. Pode me passar a disponibilidade e os valores?"
 */
export function roomWhatsappMessage(r: Pick<Room, 'name' | 'capacityMin' | 'capacityMax' | 'floor'>, url?: string): string {
  const article = /^(sala|área|area)\b/i.test(r.name) ? 'a' : 'o';
  const floor = r.floor ? ` (${r.floor})` : '';
  const people = capacityText(r).replace(/^Até/, 'até');
  return [`Olá! Quero ${article} ${r.name}${floor}, para ${people}.`, 'Pode me passar a disponibilidade e os valores?', url ?? '']
    .filter(Boolean)
    .join('\n');
}

/** Mensagem pronta do WhatsApp na página do pacote corporativo. */
export function corporateWhatsappMessage(url?: string): string {
  return ['Olá! Quero o pacote corporativo, com o andar completo.', 'Pode me passar a disponibilidade e os valores?', url ?? '']
    .filter(Boolean)
    .join('\n');
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const formatBRL = (n: number) => brl.format(n);

/** Preços visíveis da sala, do menor para o maior período. */
export function priceList(r: Room): { label: string; unit: string; value: number }[] {
  if (!r.showPrices) return [];
  const list: { label: string; unit: string; value: number }[] = [];
  if (r.priceHour) list.push({ label: 'Por hora', unit: 'hora', value: r.priceHour });
  if (r.priceShift) list.push({ label: 'Por turno', unit: 'turno', value: r.priceShift });
  if (r.priceDay) list.push({ label: 'Diária', unit: 'dia', value: r.priceDay });
  return list;
}

export function phoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

export const phoneE164 = (digits: string) => `+${digits.replace(/\D/g, '')}`;

export function whatsappUrl(s: SiteSettings, message = s.whatsappMessage): string {
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${s.whatsapp}${text}`;
}

export function fullAddress(s: SiteSettings): string {
  const a = s.address;
  return [a.street, a.complement, a.neighborhood, `${a.city} — ${a.state}`].filter(Boolean).join(', ');
}

export function mapsUrl(s: SiteSettings): string {
  const a = s.address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.street}, ${a.neighborhood}, ${a.city} - ${a.state}`)}`;
}

export function mapsEmbedUrl(s: SiteSettings): string {
  const a = s.address;
  const q = a.lat != null && a.lng != null ? `${a.lat},${a.lng}` : `${a.street}, ${a.neighborhood}, ${a.city}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=17&output=embed`;
}

export function wazeUrl(s: SiteSettings): string {
  const a = s.address;
  if (a.lat != null && a.lng != null) return `https://waze.com/ul?ll=${a.lat},${a.lng}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent(`${a.street} ${a.city}`)}&navigate=yes`;
}

// ---------------------------------------------------------------------------
// Imagens
// ---------------------------------------------------------------------------

const STATIC_WIDTHS = [480, 800, 1152];
const LQIP = lqip as Record<string, string>;

export function photoUrls(p: Photo): { avif?: string; webp: string; fallback: string; largest: string } {
  if (p.src.startsWith('static:')) {
    const name = p.src.slice(7);
    const widths = STATIC_WIDTHS.filter((w) => w <= p.w || w === STATIC_WIDTHS[0]);
    const set = (ext: string) => widths.map((w) => `/assets/img/${name}-${w}.${ext} ${w}w`).join(', ');
    return { avif: set('avif'), webp: set('webp'), fallback: `/assets/img/${name}-800.webp`, largest: `/assets/img/${name}-${widths.at(-1)}.webp` };
  }
  const key = p.src.slice(3);
  return {
    webp: `/media/${key}-720.webp 720w, /media/${key}-1600.webp 1600w`,
    fallback: `/media/${key}-720.webp`,
    largest: `/media/${key}-1600.webp`,
  };
}

export function absoluteImage(p: Photo | undefined, base: string): string {
  if (!p) return `${base}/og-image.jpg`;
  return base + photoUrls(p).largest;
}

export function picture(
  p: Photo,
  opts: { sizes: string; loading?: 'lazy' | 'eager'; priority?: boolean; className?: string; alt?: string } = { sizes: '100vw' },
): SafeHtml {
  const urls = photoUrls(p);
  const placeholder = p.src.startsWith('static:') ? LQIP[p.src.slice(7)] : undefined;
  const style = placeholder ? `background-image:url(${placeholder})` : undefined;
  return html`<picture class="${opts.className ?? 'ph'}">
    ${urls.avif ? html`<source type="image/avif" srcset="${urls.avif}" sizes="${opts.sizes}">` : ''}
    <source type="image/webp" srcset="${urls.webp}" sizes="${opts.sizes}">
    <img src="${urls.fallback}" alt="${opts.alt ?? p.alt}" width="${p.w}" height="${p.h}" loading="${opts.loading ?? 'lazy'}" decoding="${opts.priority ? 'sync' : 'async'}"${raw(opts.priority ? ' fetchpriority="high"' : '')}${style ? html` style="${style}"` : ''}>
  </picture>`;
}

/** <link rel=preload> para a imagem LCP. */
export function preloadPhoto(p: Photo, sizes: string): SafeHtml {
  const urls = photoUrls(p);
  if (urls.avif) {
    return html`<link rel="preload" as="image" type="image/avif" imagesrcset="${urls.avif}" imagesizes="${sizes}" fetchpriority="high">`;
  }
  return html`<link rel="preload" as="image" type="image/webp" imagesrcset="${urls.webp}" imagesizes="${sizes}" fetchpriority="high">`;
}

export const icon = (id: string, cls = 'i') => raw(`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#${id}"/></svg>`);

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

export function breadcrumb(items: { name: string; href?: string }[]): SafeHtml {
  return html`<nav class="crumbs" aria-label="Você está em">
    <ol>
      ${items.map((it, i) =>
        it.href && i < items.length - 1
          ? html`<li><a href="${it.href}">${it.name}</a></li>`
          : html`<li aria-current="page">${it.name}</li>`,
      )}
    </ol>
  </nav>`;
}

export function roomCard(r: Room, i: number): SafeHtml {
  const cover = r.photos[0];
  const top = r.amenities.filter((a) => a !== 'copa' && a !== 'banheiro').slice(0, 4);
  return html`<article class="room-card" data-reveal style="--i:${i}" data-capacity="${r.capacityMax}">
    <a class="room-card__media" href="/auditorios/${r.slug}" data-tilt aria-label="${r.name}: ver fotos e detalhes" tabindex="-1">
      ${cover ? picture(cover, { sizes: '(min-width: 1100px) 520px, (min-width: 720px) 45vw, 92vw' }) : html`<span class="ph ph--empty"></span>`}
      <span class="room-card__cap">${icon('people')}${capacityText(r)}</span>
    </a>
    <div class="room-card__body">
      <h3 class="room-card__title"><a href="/auditorios/${r.slug}">${r.name}</a></h3>
      ${r.tagline ? html`<p class="room-card__tagline">${r.tagline}</p>` : ''}
      <ul class="room-card__amenities" aria-label="Recursos">
        ${top.map((a) => html`<li>${icon(AMENITIES[a].icon)}<span>${AMENITIES[a].label}</span></li>`)}
      </ul>
      <div class="room-card__actions">
        <a class="link-arrow" href="/auditorios/${r.slug}">Ver o ${r.name.toLowerCase().startsWith('audit') ? 'auditório' : 'espaço'} ${icon('arrow')}</a>
        <a class="btn btn--ghost btn--sm" href="#consulta" data-room="${r.name}">Agendar sala</a>
      </div>
    </div>
  </article>`;
}

export function amenityList(r: Room): SafeHtml {
  return html`<ul class="amenities">
    ${r.amenities.map((a) => html`<li>${icon(AMENITIES[a].icon)}<span>${AMENITIES[a].label}</span></li>`)}
  </ul>`;
}

export function layoutList(r: Room): SafeHtml | '' {
  const entries = Object.entries(r.layouts) as [keyof typeof LAYOUTS, number | null][];
  if (!entries.length) return '';
  return html`<ul class="layouts">
    ${entries.map(
      ([id, cap]) => html`<li>
        ${raw(layoutGlyph(id))}
        <strong>${LAYOUTS[id].label}</strong>
        <span>${cap ? `até ${cap} pessoas` : LAYOUTS[id].hint}</span>
      </li>`,
    )}
  </ul>`;
}

/** Mini planta de cada formato de montagem (SVG estático, sem dados do usuário). */
function layoutGlyph(id: string): string {
  const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.6"/>`;
  let dots = '';
  if (id === 'auditorio') for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) dots += dot(10 + c * 8, 18 + r * 7);
  if (id === 'escolar') for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) dots += `<rect x="${7 + c * 12}" y="${15 + r * 10}" width="9" height="3" rx="1"/>` + dot(11.5 + c * 12, 21 + r * 10);
  if (id === 'u') {
    for (let c = 0; c < 5; c++) dots += dot(12 + c * 8, 44);
    for (let r = 0; r < 4; r++) dots += dot(8, 16 + r * 7) + dot(52, 16 + r * 7);
  }
  if (id === 'ilhas') for (const [cx, cy] of [[18, 22], [42, 22], [18, 40], [42, 40]]) dots += `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="currentColor"/>` + dot(cx - 8, cy) + dot(cx + 8, cy) + dot(cx, cy - 8) + dot(cx, cy + 8);
  if (id === 'reuniao') {
    dots += `<rect x="16" y="22" width="28" height="14" rx="3" fill="none" stroke="currentColor"/>`;
    for (let c = 0; c < 4; c++) dots += dot(20 + c * 7, 17) + dot(20 + c * 7, 41);
  }
  return `<svg class="layout-glyph" viewBox="0 0 60 52" aria-hidden="true"><rect x="14" y="4" width="32" height="4" rx="1.5" class="layout-glyph__screen"/><g fill="currentColor">${dots}</g></svg>`;
}

export function faqList(faqs: Faq[], id = 'faq'): SafeHtml {
  return html`<div class="faq" id="${id}">
    ${faqs.map(
      (f, i) => html`<details class="faq__item" ${raw(i === 0 ? 'open' : '')}>
        <summary><h3>${f.question}</h3><span class="faq__icon" aria-hidden="true"></span></summary>
        <div class="faq__answer"><p>${f.answer}</p></div>
      </details>`,
    )}
  </div>`;
}

/** Formulário de consulta (mesmo componente na home, nas salas e no pacote corporativo). */
export function consultForm(s: SiteSettings, rooms: Room[], opts: { preset?: string; modality?: string } = {}): SafeHtml {
  const spaces = [GUIDANCE_SPACE, ...rooms.map((r) => r.name), CORPORATE_SPACE];
  const preset = opts.preset ?? GUIDANCE_SPACE;
  return html`<form class="consult" id="consult-form" novalidate data-guidance="${GUIDANCE_SPACE}">
    <div class="field field--wide">
      <label for="f-space">Espaço de interesse</label>
      <select id="f-space" name="space">
        ${spaces.map((sp) => html`<option ${raw(sp === preset ? 'selected' : '')}>${sp}</option>`)}
      </select>
    </div>
    <div class="field">
      <label for="f-name">Seu nome</label>
      <input id="f-name" name="name" required autocomplete="name" placeholder="Como podemos chamar você?" maxlength="100">
    </div>
    <div class="field">
      <label for="f-email">E-mail</label>
      <input id="f-email" name="email" type="email" required autocomplete="email" inputmode="email" placeholder="voce@empresa.com.br" maxlength="120">
    </div>
    <div class="field">
      <label for="f-phone">WhatsApp</label>
      <input id="f-phone" name="phone" type="tel" inputmode="tel" required autocomplete="tel" placeholder="(21) 90000-0000" maxlength="20">
    </div>
    <div class="field">
      <label for="f-activity">Atividade</label>
      <select id="f-activity" name="activity">${ACTIVITIES.map((a) => html`<option>${a}</option>`)}</select>
    </div>
    <div class="field">
      <label for="f-date">Data pretendida</label>
      <input id="f-date" name="eventDate" type="date" required>
    </div>
    <div class="field">
      <label for="f-people">Participantes</label>
      <input id="f-people" name="people" type="number" min="1" max="2000" inputmode="numeric" required placeholder="Ex.: 30">
    </div>
    <div class="field">
      <label for="f-modality">Modalidade</label>
      <select id="f-modality" name="modality">
        ${MODALITIES.map((m) => html`<option ${raw(m === opts.modality ? 'selected' : '')}>${m}</option>`)}
      </select>
    </div>
    <div class="field">
      <label for="f-schedule">Horário e duração</label>
      <input id="f-schedule" name="schedule" required placeholder="Ex.: das 9h às 13h" maxlength="80">
    </div>
    <div class="field field--wide">
      <label for="f-details">O que você precisa? <span class="opt">(opcional)</span></label>
      <textarea id="f-details" name="details" rows="3" maxlength="1500" placeholder="Conte o formato da atividade e os recursos de que precisa."></textarea>
    </div>
    <div class="field field--wide field--hp" aria-hidden="true">
      <label for="f-website">Não preencha este campo</label>
      <input id="f-website" name="website" tabindex="-1" autocomplete="off">
    </div>
    <div class="field--wide consult__submit">
      <button class="btn btn--gold btn--lg" type="submit">Solicitar agendamento</button>
      <p class="consult__note">Usamos seus dados só para responder a esta consulta. <a href="/politica-de-privacidade">Política de privacidade</a></p>
    </div>
    <p class="consult__status field--wide" role="status" aria-live="polite"></p>
  </form>
  <div class="consult-result" id="consult-result" hidden tabindex="-1">
    <span class="consult-result__icon" aria-hidden="true">${icon('check')}</span>
    <p class="consult-result__title">Pedido de agendamento enviado</p>
    <p class="consult-result__text" id="consult-summary">Recebemos sua consulta. A equipe vai responder no WhatsApp ou no e-mail com disponibilidade, recursos e valores.</p>
    <div class="consult-result__actions">
      <button class="btn btn--ghost" id="new-consult" type="button">Fazer outro pedido</button>
    </div>
  </div>`;
}

export function steps(): SafeHtml {
  return html`<ol class="steps">
    <li><span class="steps__n" aria-hidden="true">1</span><div><strong>Preencha o formulário</strong><p>Data, horário, participantes e o tipo de atividade.</p></div></li>
    <li><span class="steps__n" aria-hidden="true">2</span><div><strong>Receba nossa mensagem</strong><p>A equipe responde no WhatsApp ou no e-mail com disponibilidade, recursos e valores.</p></div></li>
    <li><span class="steps__n" aria-hidden="true">3</span><div><strong>Agende a sala para o seu evento</strong><p>Com tudo combinado, a data fica reservada para você.</p></div></li>
  </ol>`;
}

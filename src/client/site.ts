/**
 * Interações do site público. Sem dependências; tudo é melhoria progressiva:
 * sem JS a página continua completa e o formulário cai no WhatsApp/e-mail.
 */

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('js');

// ---------------------------------------------------------------------------
// UTM: guarda a origem da visita para anexar à consulta
// ---------------------------------------------------------------------------
const UTM_KEY = 'utm';
function captureUtm(): void {
  try {
    const params = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const [k, v] of params) if (/^(utm_[a-z]+|gclid|fbclid|ref)$/.test(k)) utm[k] = v.slice(0, 120);
    if (Object.keys(utm).length) sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch {
    /* modo privado sem storage */
  }
}
function readUtm(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_KEY) ?? '{}');
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Cabeçalho: estado ao rolar, menu mobile e seção ativa
// ---------------------------------------------------------------------------
function header(): void {
  const el = $('[data-header]');
  const toggle = $<HTMLButtonElement>('[data-nav-toggle]');
  const nav = $('#site-nav');
  const wa = $('[data-wa-float]');
  if (!el) return;

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      el.classList.toggle('is-scrolled', y > 12);
      wa?.classList.toggle('is-visible', y > innerHeight * 0.6);
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const close = () => {
    nav?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  toggle?.addEventListener('click', () => {
    const open = !nav?.classList.contains('is-open');
    nav?.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) $('a', nav ?? document)?.focus();
  });
  nav?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) close();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav?.classList.contains('is-open')) {
      close();
      toggle?.focus();
    }
  });

  // Destaca no menu a seção visível (na home)
  const links = $$<HTMLAnchorElement>('.nav ul a[href*="#"]');
  const targets = links
    .map((a) => ({ a, el: document.getElementById(a.hash.slice(1)) }))
    .filter((t): t is { a: HTMLAnchorElement; el: HTMLElement } => Boolean(t.el) && location.pathname === '/');
  if (targets.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const t = targets.find((x) => x.el === entry.target);
          t?.a.classList.toggle('is-active', entry.isIntersecting);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    targets.forEach((t) => io.observe(t.el));
  }
}

// ---------------------------------------------------------------------------
// Revelação ao rolar (IntersectionObserver único)
// ---------------------------------------------------------------------------
function reveal(): void {
  const items = $$('[data-reveal]');
  if (!items.length) return;
  if (reducedMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
}

// ---------------------------------------------------------------------------
// Movimento: parallax do hero, inclinação dos cards, botão magnético, linha dos passos
// ---------------------------------------------------------------------------
function motion(): void {
  if (reducedMotion) return;

  const layers = $$('[data-parallax]');
  if (layers.length) {
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = scrollY;
      if (y > innerHeight * 1.2) return;
      for (const el of layers) {
        const speed = Number(el.dataset.parallax) || 0;
        el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
      }
    };
    addEventListener('scroll', () => (raf ||= requestAnimationFrame(update)), { passive: true });
  }

  if (finePointer) {
    for (const card of $$('[data-tilt]')) {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${(x * 5).toFixed(2)}deg) rotateX(${(-y * 5).toFixed(2)}deg)`;
      });
      card.addEventListener('pointerleave', () => (card.style.transform = ''));
    }
    for (const btn of $$('[data-magnetic]')) {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.12}px, ${y * 0.22}px)`;
      });
      btn.addEventListener('pointerleave', () => (btn.style.transform = ''));
    }
  }

  // Linha da sequência "Como reservar" acompanha a rolagem
  const stepLists = $$('.steps');
  if (stepLists.length) {
    let raf = 0;
    const update = () => {
      raf = 0;
      for (const list of stepLists) {
        const r = list.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (innerHeight * 0.75 - r.top) / r.height));
        list.style.setProperty('--steps-progress', p.toFixed(3));
      }
    };
    addEventListener('scroll', () => (raf ||= requestAnimationFrame(update)), { passive: true });
    update();
  }
}

// ---------------------------------------------------------------------------
// Planejador de assentos
// ---------------------------------------------------------------------------
interface PlannerRoom {
  name: string;
  slug: string;
  min: number | null;
  max: number;
}

function planner(): void {
  const root = $('#planejar');
  const range = $<HTMLInputElement>('[data-planner-range]', root ?? document);
  const dataEl = $('#planner-data');
  if (!root || !range || !dataEl) return;
  const rooms = (JSON.parse(dataEl.textContent || '{"rooms":[]}') as { rooms: PlannerRoom[] }).rooms;
  const seats = $$('.stage__seats i', root);
  const nums = $$('[data-planner-num]', root);
  const result = $('[data-planner-result]', root)!;
  const overflow = $('[data-planner-overflow]', root)!;
  const cta = $<HTMLAnchorElement>('[data-planner-cta]', root)!;
  const maxRoom = Math.max(0, ...rooms.map((r) => r.max));
  let last = -1;

  const render = (n: number) => {
    const min = Number(range.min);
    const max = Number(range.max);
    range.style.setProperty('--pct', `${((n - min) / (max - min)) * 100}%`);
    nums.forEach((el) => (el.textContent = String(n)));
    // acende assento por assento; a direção do atraso segue o movimento
    const growing = n > last;
    seats.forEach((seat, i) => {
      const on = i < n;
      const delay = growing ? Math.max(0, i - Math.max(0, last)) : Math.max(0, Math.max(0, last) - i);
      seat.style.setProperty('--d', String(Math.min(delay, 40)));
      seat.classList.toggle('on', on);
      seat.classList.toggle('over', on && i >= maxRoom);
    });
    last = n;
    const extra = n - seats.length;
    overflow.hidden = extra <= 0;
    overflow.textContent = extra > 0 ? `+ ${extra} pessoas além da planta` : '';

    const fits = rooms.filter((r) => r.max >= n);
    result.replaceChildren();
    const p = document.createElement('p');
    if (fits.length) {
      p.textContent = fits.length === rooms.length ? `Todos os ${rooms.length} auditórios comportam ${n} pessoas:` : `${fits.length === 1 ? 'Comporta' : 'Comportam'} ${n} pessoas:`;
      const ul = document.createElement('ul');
      ul.className = 'planner__rooms';
      for (const r of fits) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `/auditorios/${r.slug}`;
        a.textContent = r.name;
        li.append(a);
        ul.append(li);
      }
      result.append(p, ul);
      cta.dataset.room = fits.length === 1 ? fits[0].name : 'Quero orientação';
      cta.dataset.modality = '';
    } else {
      p.textContent = `Nenhum auditório sozinho recebe ${n} pessoas (o maior comporta ${maxRoom}). O pacote corporativo reúne três salas no mesmo andar.`;
      const a = document.createElement('a');
      a.href = '/pacote-corporativo';
      a.className = 'inline';
      a.textContent = 'Conhecer o pacote corporativo';
      result.append(p, a);
      cta.dataset.room = 'Andar completo — pacote corporativo';
      cta.dataset.modality = 'Pacote corporativo';
    }
    cta.dataset.people = String(n);
  };

  range.addEventListener('input', () => render(Number(range.value)));
  $$<HTMLInputElement>('[data-planner-activity] input', root).forEach((input) =>
    input.addEventListener('change', () => (cta.dataset.activity = input.value)),
  );
  cta.dataset.activity = $<HTMLInputElement>('[data-planner-activity] input:checked', root)?.value ?? '';
  render(Number(range.value));
}

// ---------------------------------------------------------------------------
// Formulário de consulta
// ---------------------------------------------------------------------------
type FormFields = HTMLFormControlsCollection & Record<string, HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>;
const DRAFT_KEY = 'consulta-rascunho';

function setField(form: HTMLFormElement, name: string, value: string): void {
  const el = (form.elements as FormFields)[name];
  if (!el || !value) return;
  if (el instanceof HTMLSelectElement && ![...el.options].some((o) => o.value === value)) {
    el.add(new Option(value, value));
  }
  el.value = value;
  const wrap = el.closest('.field');
  wrap?.classList.remove('is-prefilled');
  void (wrap as HTMLElement | null)?.offsetWidth;
  wrap?.classList.add('is-prefilled');
}

function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function consultForm(): void {
  const form = $<HTMLFormElement>('#consult-form');
  if (!form) return;
  const result = $('#consult-result')!;
  const summary = $('#consult-summary')!;
  const status = $('.consult__status', form)!;
  const fields = form.elements as FormFields;
  const brand = form.dataset.brand ?? '';
  const startedAt = performance.now();

  const date = fields.eventDate;
  if (date) date.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // Rascunho local (só nesta aba) para não perder o que foi digitado
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, string>;
    for (const [k, v] of Object.entries(draft)) if (k !== 'website') setField(form, k, v);
    form.querySelectorAll('.is-prefilled').forEach((el) => el.classList.remove('is-prefilled'));
  } catch {
    /* sem storage */
  }
  form.addEventListener('input', () => {
    try {
      const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
      delete data.website;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* sem storage */
    }
  });

  // Botões "Consultar" espalhados pela página preenchem o formulário
  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-room], [data-activity], [data-people]');
    if (!trigger || !trigger.matches('a[href*="#consulta"]')) return;
    const { room, activity, people, modality } = trigger.dataset;
    if (room) setField(form, 'space', room);
    if (activity) setField(form, 'activity', activity);
    if (people) setField(form, 'people', people);
    if (modality) setField(form, 'modality', modality);
    else if (room?.includes('pacote corporativo')) setField(form, 'modality', 'Pacote corporativo');
    if (!result.hidden) showForm();
    // foca o primeiro campo vazio depois da rolagem
    setTimeout(() => {
      const empty = ['name', 'email', 'phone', 'eventDate', 'people', 'schedule'].map((n) => fields[n]).find((f) => f && !f.value);
      empty?.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 650);
  });

  const showForm = () => {
    result.hidden = true;
    form.hidden = false;
  };
  $('#new-consult')?.addEventListener('click', () => {
    showForm();
    fields.eventDate?.focus();
  });

  const clearErrors = () => {
    $$('.field.is-invalid', form).forEach((f) => f.classList.remove('is-invalid'));
    $$('.field__error', form).forEach((e) => e.remove());
    $$('[aria-invalid]', form).forEach((e) => e.removeAttribute('aria-invalid'));
    status.textContent = '';
  };
  const markError = (name: string, msg: string) => {
    const el = fields[name];
    const wrap = el?.closest('.field');
    if (!wrap) return;
    wrap.classList.add('is-invalid');
    el.setAttribute('aria-invalid', 'true');
    const p = document.createElement('p');
    p.className = 'field__error';
    p.id = `err-${name}`;
    p.textContent = msg;
    el.setAttribute('aria-describedby', p.id);
    wrap.append(p);
  };
  /** Erro de envio com atalho para o WhatsApp, para a consulta não se perder. */
  const sendFailed = (msg: string, waHref: string) => {
    status.textContent = `${msg} `;
    const a = document.createElement('a');
    a.href = waHref;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Falar com a equipe no WhatsApp';
    status.append(a);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const email = (data.email ?? '').trim();
    const errors: Record<string, string> = {};
    if ((data.name ?? '').trim().length < 2) errors.name = 'Informe seu nome.';
    if (!email) errors.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Confira o e-mail.';
    const phoneDigits = (data.phone ?? '').replace(/\D/g, '');
    if (!phoneDigits) errors.phone = 'Informe seu WhatsApp.';
    else if (phoneDigits.length < 10) errors.phone = 'Inclua o DDD no WhatsApp.';
    if (!data.eventDate) errors.eventDate = 'Escolha a data pretendida.';
    if (!data.people || Number(data.people) < 1) errors.people = 'Informe quantas pessoas vão participar.';
    if (!(data.schedule ?? '').trim()) errors.schedule = 'Informe o horário e a duração.';
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([k, v]) => markError(k, v));
      status.textContent = 'Revise os campos destacados.';
      fields[Object.keys(errors)[0]]?.focus();
      return;
    }

    // Texto pronto para quem quiser falar já no WhatsApp (sucesso ou falha no envio)
    const message = [
      `Olá! Acabei de enviar uma consulta pelo site da ${brand}.`,
      '',
      `Espaço: ${data.space}`,
      `Nome: ${data.name.trim()}`,
      `Atividade: ${data.activity}`,
      `Data: ${formatDateBr(data.eventDate)}`,
      `Participantes: ${data.people}`,
      `Horário e duração: ${data.schedule.trim()}`,
    ].join('\n');
    const waHref = `https://wa.me/${form.dataset.whatsapp}?text=${encodeURIComponent(message)}`;

    const button = $<HTMLButtonElement>('button[type="submit"]', form)!;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Enviando…';
    let sent = false;
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          email,
          people: Number(data.people),
          channel: 'formulario',
          utm: readUtm(),
          page: location.pathname,
          elapsedMs: Math.round(performance.now() - startedAt),
        }),
      });
      if (res.ok) sent = true;
      else {
        const body = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
        if (res.status === 422 && body.fields) {
          Object.entries(body.fields).forEach(([k, v]) => markError(k, v));
          status.textContent = body.error ?? 'Revise os campos destacados.';
          fields[Object.keys(body.fields)[0]]?.focus();
          return;
        }
        sendFailed(body.error ?? 'Não foi possível enviar agora. Tente de novo em instantes.', waHref);
      }
    } catch {
      sendFailed('Sem conexão no momento. Confira a internet e tente de novo.', waHref);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
    if (!sent) return;

    const firstName = data.name.trim().split(/\s+/)[0];
    const when = formatDateBr(data.eventDate);
    const about = data.space === form.dataset.guidance ? when : `${data.space}, ${when}`;
    summary.textContent = `Obrigado, ${firstName}. A equipe vai responder no WhatsApp ou no e-mail ${email} com disponibilidade, recursos e valores (${about}).`;
    $<HTMLAnchorElement>('#send-whatsapp')!.href = waHref;

    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* sem storage */
    }
    form.hidden = true;
    result.hidden = false;
    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  });
}

// ---------------------------------------------------------------------------
// Galeria da sala + lightbox
// ---------------------------------------------------------------------------
function gallery(): void {
  const root = $('[data-gallery]');
  if (!root) return;
  const slides = $$('[data-slide]', root);
  const thumbs = $$<HTMLButtonElement>('[data-thumb]', root);
  const counter = $('[data-gallery-index]', root);
  const photos = JSON.parse($('[data-gallery-data]', root)?.textContent || '[]') as { src: string; alt: string }[];
  let index = 0;

  const show = (i: number) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === index);
      s.toggleAttribute('aria-hidden', k !== index);
    });
    thumbs.forEach((t, k) => t.setAttribute('aria-selected', String(k === index)));
    if (counter) counter.textContent = String(index + 1);
    thumbs[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  };
  $('[data-gallery-prev]', root)?.addEventListener('click', () => show(index - 1));
  $('[data-gallery-next]', root)?.addEventListener('click', () => show(index + 1));
  thumbs.forEach((t, k) => t.addEventListener('click', () => show(k)));

  // gesto de arrastar no celular
  const stage = $('.gallery__stage', root);
  let startX = 0;
  stage?.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
  stage?.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1));
  });

  const dialog = $<HTMLDialogElement>('[data-lightbox-dialog]', root);
  const img = $<HTMLImageElement>('[data-lightbox-img]', root);
  const caption = $('[data-lightbox-caption]', root);
  if (!dialog || !img) return;
  let lb = 0;
  const showLb = (i: number) => {
    lb = (i + photos.length) % photos.length;
    img.src = photos[lb].src;
    img.alt = photos[lb].alt;
    if (caption) caption.textContent = `${photos[lb].alt}${photos.length > 1 ? ` (${lb + 1}/${photos.length})` : ''}`;
  };
  $$<HTMLButtonElement>('[data-lightbox]', root).forEach((b) =>
    b.addEventListener('click', () => {
      showLb(Number(b.dataset.lightbox));
      dialog.showModal();
    }),
  );
  $('[data-lightbox-close]', dialog)?.addEventListener('click', () => dialog.close());
  $('[data-lightbox-prev]', dialog)?.addEventListener('click', () => showLb(lb - 1));
  $('[data-lightbox-next]', dialog)?.addEventListener('click', () => showLb(lb + 1));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') showLb(lb - 1);
    if (e.key === 'ArrowRight') showLb(lb + 1);
  });
  dialog.addEventListener('close', () => show(lb));
}

// ---------------------------------------------------------------------------
// Vídeo: só carrega/toca quando visível; respeita economia de dados e movimento reduzido
// ---------------------------------------------------------------------------
function videos(): void {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  for (const video of $$<HTMLVideoElement>('video[data-autoplay-visible]')) {
    const toggle = video.parentElement?.querySelector<HTMLButtonElement>('[data-video-toggle]');
    let userPaused = false;
    const sync = () => toggle?.setAttribute('aria-pressed', String(!video.paused));
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    toggle?.addEventListener('click', () => {
      if (video.paused) {
        userPaused = false;
        void video.play().catch(() => undefined);
      } else {
        userPaused = true;
        video.pause();
      }
    });
    if (reducedMotion || saveData) continue; // fica no poster até a pessoa apertar play
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused) void video.play().catch(() => undefined);
        else if (!entry.isIntersecting) video.pause();
      },
      { threshold: 0.35 },
    ).observe(video);
  }
}

// ---------------------------------------------------------------------------
// Mapa do Google só depois do clique (privacidade + desempenho)
// ---------------------------------------------------------------------------
function maps(): void {
  for (const map of $$('[data-map]')) {
    $('[data-map-load]', map)?.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = map.dataset.map ?? '';
      iframe.title = 'Mapa com a localização dos auditórios';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      map.replaceChildren(iframe);
    });
  }
}

// ---------------------------------------------------------------------------
// Planta do pacote corporativo: itens da lista destacam a área correspondente
// ---------------------------------------------------------------------------
function floorPlan(): void {
  for (const item of $$('[data-zone-link]')) {
    const zone = item.dataset.zoneLink;
    if (!zone) continue;
    const scope = item.closest('section') ?? document;
    const on = (v: boolean) => {
      $$(`.plan__zone[data-zone="${zone}"]`, scope).forEach((z) => z.classList.toggle('is-on', v));
      item.classList.toggle('is-active', v);
    };
    item.addEventListener('pointerenter', () => on(true));
    item.addEventListener('pointerleave', () => on(false));
    item.addEventListener('focus', () => on(true));
    item.addEventListener('blur', () => on(false));
  }
}

// ---------------------------------------------------------------------------
// Filtro por participantes (/auditorios)
// ---------------------------------------------------------------------------
function roomFilter(): void {
  const input = $<HTMLInputElement>('[data-filter-people]');
  if (!input) return;
  const cards = $$('.rooms--list .room-card');
  const status = $('[data-filter-status]');
  const empty = $('[data-filter-empty]');
  $('[data-room-filter]')?.addEventListener('submit', (e) => e.preventDefault());
  input.addEventListener('input', () => {
    const n = Number(input.value) || 0;
    let visible = 0;
    for (const card of cards) {
      const fits = !n || Number(card.dataset.capacity) >= n;
      card.hidden = !fits;
      if (fits) {
        visible++;
        card.classList.add('is-in');
      }
    }
    if (status) status.textContent = n ? `${visible} ${visible === 1 ? 'auditório comporta' : 'auditórios comportam'} ${n} pessoas` : `${cards.length} auditórios disponíveis`;
    if (empty) empty.hidden = visible > 0;
  });
}

// ---------------------------------------------------------------------------
// Barra fixa no celular (página da sala)
// ---------------------------------------------------------------------------
function mobileBar(): void {
  const bar = $('[data-mobile-bar]');
  const gallery = $('[data-gallery]');
  const consult = $('#consulta');
  if (!bar || !gallery) return;
  let galleryOut = false;
  let consultIn = false;
  const sync = () => bar.classList.toggle('is-visible', galleryOut && !consultIn);
  new IntersectionObserver(([e]) => {
    galleryOut = !e.isIntersecting && e.boundingClientRect.top < 0;
    sync();
  }).observe(gallery);
  if (consult)
    new IntersectionObserver(([e]) => {
      consultIn = e.isIntersecting;
      sync();
    }).observe(consult);
}

// ---------------------------------------------------------------------------
captureUtm();
header();
reveal();
motion();
planner();
consultForm();
gallery();
videos();
maps();
floorPlan();
roomFilter();
mobileBar();

/** Helpers de DOM: nada de dados do servidor passa por innerHTML. */

export type Child = Node | string | number | null | undefined | false | Child[];
export type Handler = (ev: Event) => void;
export type PropValue = string | number | boolean | null | undefined | Handler;
export type Props = Record<string, PropValue>;

const LATE_PROPS = new Set(['value']);

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const late: [string, PropValue][] = [];
  if (props) {
    for (const [key, val] of Object.entries(props)) {
      if (val === null || val === undefined || val === false) continue;
      if (typeof val === 'function') {
        el.addEventListener(key.replace(/^on/, '').toLowerCase(), val);
      } else if (key === 'class') {
        el.className = String(val);
      } else if (LATE_PROPS.has(key)) {
        late.push([key, val]);
      } else if (val === true) {
        el.setAttribute(key, '');
      } else {
        el.setAttribute(key, String(val));
      }
    }
  }
  append(el, children);
  for (const [key, val] of late) (el as unknown as Record<string, unknown>)[key] = val;
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(el: Element, ...children: Child[]): void {
  clear(el);
  append(el, children);
}

/* ---------------- Ícones (SVG estático, sem dados interpolados) ---------------- */

const ICONS = {
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  left: '<path d="M19 12H5M12 5l-7 7 7 7"/>',
  right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
} as const;
export type IconName = keyof typeof ICONS;

export function icon(name: IconName): HTMLSpanElement {
  const s = h('span', { class: 'ico', 'aria-hidden': 'true' });
  s.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return s;
}

/** Botão só com ícone (com nome acessível). */
export function iconButton(name: IconName, label: string, onclick: Handler, extra: Props = {}): HTMLButtonElement {
  return h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': label, title: label, onclick, ...extra }, icon(name));
}

/* ---------------- Formatação ---------------- */

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-11-08" -> "08/11/2026" */
export function fmtDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let t: number | undefined;
  return (...a: A) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
}

/** Texto de campo numérico -> número ou null (aceita vírgula decimal). */
export function toNumber(v: string): number | null {
  const s = v.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ---------------- Toasts ---------------- */

export function toast(message: string, kind: 'ok' | 'error' = 'ok'): void {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, message);
  box.appendChild(t);
  window.setTimeout(() => t.remove(), kind === 'error' ? 7000 : 4000);
}

/* ---------------- Diálogos ---------------- */

export function modal<T>(build: (close: (value?: T) => void) => Child[], label: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dlg', 'aria-label': label });
    let result: T | undefined;
    const close = (value?: T) => {
      result = value;
      dlg.close();
    };
    append(dlg, build(close));
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(result);
    });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

export async function confirmDialog(opts: { title: string; message: string; confirmLabel: string; danger?: boolean }): Promise<boolean> {
  const r = await modal<boolean>(
    (close) => [
      h('h2', null, opts.title),
      h('p', null, opts.message),
      h(
        'div',
        { class: 'dlg-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => close(false), autofocus: true }, 'Cancelar'),
        h('button', { type: 'button', class: opts.danger ? 'btn btn-danger' : 'btn btn-primary', onclick: () => close(true) }, opts.confirmLabel),
      ),
    ],
    opts.title,
  );
  return r === true;
}

/* ---------------- Botões e campos ---------------- */

/** Desabilita o botão e troca o texto enquanto a promessa não termina. */
export async function busy<T>(btn: HTMLButtonElement, label: string, fn: () => Promise<T>): Promise<T> {
  const original = btn.textContent ?? '';
  btn.disabled = true;
  btn.textContent = label;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

let uidCounter = 0;
export const uid = (p = 'f'): string => `${p}${++uidCounter}`;

export interface FieldOpts {
  name?: string;
  hint?: string;
  /** Mostra contador "n/max" */
  counterMax?: number;
  cls?: string;
  required?: boolean;
}

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Envolve um controle com label, dica, contador e área de erro (`data-err`). */
export function field(label: string, control: Control, opts: FieldOpts = {}): HTMLDivElement {
  const id = uid();
  control.id = id;
  if (opts.name) control.name = opts.name;
  const described: string[] = [];
  const wrap = h('div', { class: `field ${opts.cls ?? ''}` });
  wrap.appendChild(h('label', { for: id }, label, opts.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null));
  wrap.appendChild(control);
  if (opts.hint) {
    const hid = `${id}-h`;
    described.push(hid);
    wrap.appendChild(h('p', { class: 'hint', id: hid }, opts.hint));
  }
  if (opts.counterMax) {
    const max = opts.counterMax;
    const c = h('span', { class: 'counter' });
    const upd = () => {
      c.textContent = `${control.value.length}/${max}`;
      c.classList.toggle('over', control.value.length > max);
    };
    control.addEventListener('input', upd);
    upd();
    wrap.appendChild(c);
  }
  const errId = `${id}-e`;
  described.push(errId);
  wrap.appendChild(h('p', { class: 'err', id: errId, 'data-err': opts.name ?? '' }));
  control.setAttribute('aria-describedby', described.join(' '));
  return wrap;
}

export function textInput(value: string, attrs: Props = {}): HTMLInputElement {
  return h('input', { type: 'text', value, ...attrs });
}

export function textArea(value: string, rows = 4, attrs: Props = {}): HTMLTextAreaElement {
  const t = h('textarea', { rows, ...attrs });
  t.value = value;
  return t;
}

export function select(options: { value: string; label: string }[], value: string, attrs: Props = {}): HTMLSelectElement {
  return h(
    'select',
    { value, ...attrs },
    options.map((o) => h('option', { value: o.value }, o.label)),
  );
}

/** Interruptor acessível (checkbox com aparência de switch). */
export function toggle(label: string, checked: boolean, onChange?: (v: boolean) => void, name?: string): { el: HTMLLabelElement; input: HTMLInputElement } {
  const input = h('input', { type: 'checkbox', role: 'switch', class: 'switch-input', name: name ?? null });
  input.checked = checked;
  if (onChange) input.addEventListener('change', () => onChange(input.checked));
  const el = h('label', { class: 'switch' }, input, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), h('span', { class: 'switch-label' }, label));
  return { el, input };
}

export function checkbox(label: string, checked: boolean, name?: string): { el: HTMLLabelElement; input: HTMLInputElement } {
  const input = h('input', { type: 'checkbox', name: name ?? null });
  input.checked = checked;
  return { el: h('label', { class: 'check' }, input, h('span', null, label)), input };
}

/** Limpa e mostra erros por campo dentro de `root`. Devolve as mensagens sem campo correspondente. */
export function showFieldErrors(root: ParentNode, fields: Record<string, string> | undefined): string[] {
  root.querySelectorAll<HTMLElement>('[data-err]').forEach((e) => (e.textContent = ''));
  root.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  const unmatched: string[] = [];
  let first: HTMLElement | null = null;
  const slots = Array.from(root.querySelectorAll<HTMLElement>('[data-err]'));
  for (const [key, msg] of Object.entries(fields ?? {})) {
    const slot = slots.find((e) => e.dataset.err === key);
    if (!slot) {
      unmatched.push(msg);
      continue;
    }
    slot.textContent = msg;
    const input = slot.parentElement?.querySelector<HTMLElement>('input, textarea, select');
    input?.setAttribute('aria-invalid', 'true');
    first ??= input ?? slot;
  }
  first?.focus();
  return unmatched;
}

export function pagination(page: number, pageSize: number, total: number, go: (p: number) => void): HTMLElement {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return h(
    'nav',
    { class: 'pager', 'aria-label': 'Paginação' },
    h('button', { type: 'button', class: 'btn', disabled: page <= 1, onclick: () => go(page - 1) }, 'Anterior'),
    h('span', { class: 'pager-info' }, `Página ${page} de ${pages} · ${total} ${total === 1 ? 'registro' : 'registros'}`),
    h('button', { type: 'button', class: 'btn', disabled: page >= pages, onclick: () => go(page + 1) }, 'Próxima'),
  );
}

export function emptyState(text: string, action?: Node): HTMLElement {
  return h('div', { class: 'empty' }, h('p', null, text), action);
}

export function pageHead(title: string, ...actions: Child[]): HTMLElement {
  return h('header', { class: 'page-head' }, h('h1', null, title), h('div', { class: 'page-actions' }, ...actions));
}

/** Move o item `from` para `to` num array (cópia). */
export function moved<T>(arr: T[], from: number, to: number): T[] {
  const out = arr.slice();
  if (to < 0 || to >= out.length || from === to) return out;
  const [it] = out.splice(from, 1);
  out.splice(to, 0, it as T);
  return out;
}

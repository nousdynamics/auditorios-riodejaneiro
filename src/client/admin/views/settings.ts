import type { InfoItem, SiteSettings } from '../../../shared/types';
import { ApiFailure, api, errorMessage } from '../api';
import { busy, field, h, iconButton, moved, mount, pageHead, showFieldErrors, textArea, textInput, toNumber, toast } from '../dom';
import type { ViewCtx } from '../router';

type Control = HTMLInputElement | HTMLTextAreaElement;

interface ListEditor {
  el: HTMLElement;
  get(): InfoItem[];
}

function listEditor(title: string, hint: string, initial: InfoItem[], max: number, onChange: () => void): ListEditor {
  let items = initial.map((i) => ({ ...i }));
  const box = h('ol', { class: 'info-list' });
  const addBtn = h('button', { type: 'button', class: 'btn', onclick: () => { items.push({ title: '', text: '' }); changed(); box.querySelectorAll<HTMLInputElement>('input')[items.length * 1 - 1]?.focus(); } }, 'Adicionar item');
  const changed = () => {
    draw();
    onChange();
  };
  const shift = (i: number, to: number, act: string) => {
    items = moved(items, i, to);
    changed();
    box.querySelectorAll('li')[to]?.querySelector<HTMLElement>(`[data-act="${act}"]:not([disabled])`)?.focus();
  };
  function draw() {
    mount(
      box,
      items.map((it, i) => {
        const t = textInput(it.title, { maxlength: '80', 'aria-label': `${title}, item ${i + 1}: título` });
        const x = textArea(it.text, 2, { maxlength: '400', 'aria-label': `${title}, item ${i + 1}: texto` });
        t.addEventListener('input', () => { it.title = t.value; onChange(); });
        x.addEventListener('input', () => { it.text = x.value; onChange(); });
        return h(
          'li',
          { class: 'info-item' },
          h('div', { class: 'info-fields' }, h('div', { class: 'field' }, h('span', { class: 'mini-label' }, 'Título'), t), h('div', { class: 'field' }, h('span', { class: 'mini-label' }, 'Texto'), x)),
          h(
            'div',
            { class: 'row-actions' },
            iconButton('up', `Subir item ${i + 1}`, () => shift(i, i - 1, 'up'), { 'data-act': 'up', disabled: i === 0 }),
            iconButton('down', `Descer item ${i + 1}`, () => shift(i, i + 1, 'down'), { 'data-act': 'down', disabled: i === items.length - 1 }),
            iconButton('trash', `Remover item ${i + 1}`, () => { items = items.filter((_, k) => k !== i); changed(); }, { class: 'btn btn-icon btn-danger-ghost' }),
          ),
        );
      }),
    );
    addBtn.disabled = items.length >= max;
  }
  draw();
  const el = h('div', { class: 'list-editor' }, h('h3', null, title), h('p', { class: 'hint' }, `${hint} Até ${max} itens.`), box, addBtn);
  return { el, get: () => items.map((i) => ({ title: i.title.trim(), text: i.text.trim() })) };
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts.slice(0, -1)) {
    const next = (cur[p] ?? {}) as Record<string, unknown>;
    cur[p] = next;
    cur = next;
  }
  cur[parts[parts.length - 1] as string] = value;
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export async function settingsView(ctx: ViewCtx): Promise<void> {
  const s = await api<SiteSettings>('GET', '/settings', undefined, { signal: ctx.signal });
  const controls = new Map<string, { el: Control; numeric: boolean }>();
  let refresh = () => undefined as void;
  const onChange = () => refresh();

  const txt = (label: string, path: string, o: { max?: number; area?: boolean; hint?: string; required?: boolean; numeric?: boolean; type?: string } = {}): HTMLElement => {
    const raw = getPath(s, path);
    const val = raw === null || raw === undefined ? '' : String(raw);
    const el: Control = o.area
      ? textArea(val, 3, { maxlength: o.max ? String(o.max + 20) : null })
      : textInput(val, { maxlength: o.max ? String(o.max + 20) : null, type: o.type ?? 'text', inputmode: o.numeric ? 'decimal' : null });
    controls.set(path, { el, numeric: Boolean(o.numeric) });
    return field(label, el, { name: path, hint: o.hint, counterMax: o.max && o.area ? o.max : undefined, required: o.required });
  };
  const panel = (title: string, ...children: Node[]) => h('section', { class: 'panel form-section' }, h('h2', null, title), ...children);

  const uses = listEditor('Usos do espaço', 'Cada item vira um cartão na página inicial.', s.uses, 6, onChange);
  const facts = listEditor('Destaques do pacote', 'Fatos curtos sobre o pacote corporativo.', s.corporate.facts, 6, onChange);
  const notes = listEditor('Como chegar', 'Dicas de transporte e referências.', s.location.notes, 6, onChange);

  const form = h('form', { class: 'settings-form', novalidate: true });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar configurações');
  const flag = h('span', { class: 'dirty-flag', role: 'status' });

  const collect = (): SiteSettings => {
    const out: Record<string, unknown> = {};
    for (const [path, c] of controls) {
      const v = c.el.value.trim();
      setPath(out, path, c.numeric ? toNumber(v) : path === 'whatsapp' ? v.replace(/\D/g, '') : v);
    }
    setPath(out, 'uses', uses.get());
    setPath(out, 'corporate.facts', facts.get());
    setPath(out, 'location.notes', notes.get());
    return out as unknown as SiteSettings;
  };
  const snap = () => JSON.stringify(collect());
  let baseline = '';
  refresh = () => {
    flag.textContent = snap() !== baseline ? 'Alterações não salvas' : '';
  };
  form.addEventListener('input', refresh);

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const data = collect();
    const local: Record<string, string> = {};
    if (!data.brandName) local.brandName = 'Informe o nome da marca.';
    if (data.whatsapp && (data.whatsapp.length < 12 || data.whatsapp.length > 13)) local.whatsapp = 'Use DDI + DDD + número, ex.: 5521967770445.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) local.email = 'E-mail inválido. Confira se tem @ e domínio.';
    for (const k of ['instagram', 'facebook', 'linkedin'] as const) {
      const v = data.social[k];
      if (v && !/^https:\/\/\S+$/.test(v)) local[`social.${k}`] = 'Use um link completo começando com https://';
    }
    if (Object.keys(local).length) {
      showFieldErrors(form, local);
      toast('Revise os campos marcados e salve de novo.', 'error');
      return;
    }
    void busy(submit, 'Salvando…', async () => {
      try {
        showFieldErrors(form, {});
        const saved = await api<SiteSettings>('PUT', '/settings', data);
        for (const [path, c] of controls) {
          const v = getPath(saved, path);
          c.el.value = v === null || v === undefined ? '' : String(v);
          c.el.dispatchEvent(new Event('input'));
        }
        baseline = snap();
        refresh();
        toast('Configurações salvas');
      } catch (e) {
        const fe = e instanceof ApiFailure ? e.fields : undefined;
        // O servidor devolve a chave final (ex.: "street"); aponta para o caminho completo quando não há ambiguidade.
        const mapped: Record<string, string> = {};
        for (const [k, msg] of Object.entries(fe ?? {})) {
          const hits = [...controls.keys()].filter((p) => p === k || p.endsWith(`.${k}`));
          mapped[hits.length === 1 ? (hits[0] as string) : k] = msg;
        }
        const rest = showFieldErrors(form, mapped);
        toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
      }
    });
  });

  mount(
    form,
    panel(
      'Marca e contato',
      h(
        'div',
        { class: 'grid-form' },
        txt('Nome da marca', 'brandName', { max: 60, required: true }),
        txt('Linha abaixo do nome', 'brandLine', { max: 80 }),
        txt('WhatsApp', 'whatsapp', { max: 20, required: true, hint: 'DDI + DDD + número, só dígitos. Ex.: 5521967770445', numeric: false }),
        txt('E-mail', 'email', { max: 120, required: true, type: 'email' }),
      ),
      txt('Mensagem inicial do WhatsApp', 'whatsappMessage', { max: 300, area: true, hint: 'Texto que já aparece escrito quando a pessoa clica no botão de WhatsApp.' }),
      txt('Horário de atendimento', 'openingHours', { max: 160, hint: 'Opcional. Ex.: Segunda a sexta, das 8h às 18h.' }),
    ),
    panel(
      'Endereço',
      h(
        'div',
        { class: 'grid-form' },
        txt('Rua e número', 'address.street', { max: 120, required: true }),
        txt('Complemento', 'address.complement', { max: 120 }),
        txt('Bairro', 'address.neighborhood', { max: 80 }),
        txt('Cidade', 'address.city', { max: 80, required: true }),
        txt('Estado (sigla)', 'address.state', { max: 2 }),
        txt('CEP', 'address.postalCode', { max: 9 }),
        txt('Latitude', 'address.lat', { numeric: true, hint: 'Ex.: -22,9068' }),
        txt('Longitude', 'address.lng', { numeric: true, hint: 'Ex.: -43,1729' }),
      ),
    ),
    panel(
      'Página inicial',
      txt('Título principal', 'hero.title', { max: 140, required: true }),
      txt('Texto de apoio', 'hero.intro', { max: 400, area: true }),
      txt('Observação', 'hero.note', { max: 160 }),
      h('div', { class: 'grid-form' }, txt('Legenda da capacidade', 'stats.capacityLabel', { max: 20 }), txt('Ponto de referência', 'stats.landmark', { max: 60 })),
      uses.el,
    ),
    panel('Pacote corporativo', txt('Título', 'corporate.title', { max: 120 }), txt('Texto', 'corporate.text', { max: 800, area: true }), facts.el),
    panel('Localização', txt('Título', 'location.title', { max: 120 }), txt('Texto', 'location.text', { max: 600, area: true }), notes.el),
    panel(
      'Redes sociais',
      h(
        'div',
        { class: 'grid-form' },
        txt('Instagram', 'social.instagram', { max: 200, type: 'url', hint: 'Link completo, começando com https://' }),
        txt('Facebook', 'social.facebook', { max: 200, type: 'url' }),
        txt('LinkedIn', 'social.linkedin', { max: 200, type: 'url' }),
      ),
    ),
    h('div', { class: 'savebar' }, h('div', { class: 'savebar-inner' }, flag, submit)),
  );
  mount(ctx.root, pageHead('Configurações'), form);
  baseline = snap();
  ctx.setGuard(() => snap() !== baseline);
}

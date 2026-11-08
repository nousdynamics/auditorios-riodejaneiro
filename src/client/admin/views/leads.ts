import { LEAD_STATUS } from '../../../shared/catalog';
import type { Lead, LeadStatus, Paginated } from '../../../shared/types';
import { api, errorMessage } from '../api';
import { busy, confirmDialog, debounce, emptyState, field, fmtDate, fmtDateTime, h, icon, mount, pageHead, pagination, select, textArea, textInput, toast, showFieldErrors } from '../dom';
import type { ViewCtx } from '../router';
import { isAdmin, leadCache, rememberLeads } from '../state';
import { statusPill } from './dashboard';

const PAGE_SIZE = 25;
const STATUS_ORDER = Object.keys(LEAD_STATUS) as LeadStatus[];

function listHash(status: string, q: string, page: number): string {
  const p = new URLSearchParams();
  if (status) p.set('status', status);
  if (q) p.set('q', q);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return `#/consultas${s ? `?${s}` : ''}`;
}

export async function leadsView(ctx: ViewCtx): Promise<void> {
  let status = ctx.query.get('status') ?? '';
  if (status && !(status in LEAD_STATUS)) status = '';
  const q = ctx.query.get('q') ?? '';
  const page = Math.max(1, Number(ctx.query.get('page')) || 1);

  const search = textInput(q, { type: 'search', placeholder: 'Buscar por nome, e-mail, telefone ou espaço', maxlength: '80' });
  const go = (s: string, text: string, p: number) => {
    ctx.navigate(listHash(s, text, p));
  };
  search.addEventListener(
    'input',
    debounce(() => go(status, search.value.trim(), 1), 400),
  );

  const chips = h(
    'div',
    { class: 'chips', role: 'group', 'aria-label': 'Filtrar por status' },
    [['', 'Todas'] as const, ...STATUS_ORDER.map((s) => [s, LEAD_STATUS[s]] as const)].map(([val, label]) =>
      h('a', { class: `chip${val === status ? ' active' : ''}`, href: listHash(val, q, 1), 'aria-pressed': String(val === status) }, label),
    ),
  );

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const data = await api<Paginated<Lead>>('GET', `/leads?${params.toString()}`, undefined, { signal: ctx.signal });
  rememberLeads(data.items);

  const head = ['Recebida em', 'Nome', 'Espaço', 'Data pretendida', 'Participantes', 'Status'];
  const table = data.items.length
    ? h(
        'table',
        { class: 'table stack-table' },
        h('thead', null, h('tr', null, head.map((c) => h('th', { scope: 'col' }, c)))),
        h(
          'tbody',
          null,
          data.items.map((l) =>
            h(
              'tr',
              null,
              h('td', { 'data-label': head[0] as string }, fmtDateTime(l.createdAt)),
              h('td', { 'data-label': head[1] as string }, h('a', { href: `#/consultas/${encodeURIComponent(l.id)}` }, l.name)),
              h('td', { 'data-label': head[2] as string }, l.space),
              h('td', { 'data-label': head[3] as string }, fmtDate(l.eventDate)),
              h('td', { 'data-label': head[4] as string, class: 'num' }, l.people === null ? '—' : String(l.people)),
              h('td', { 'data-label': head[5] as string }, statusPill(l.status)),
            ),
          ),
        ),
      )
    : emptyState(q || status ? 'Nenhuma consulta com esses filtros. Limpe a busca ou escolha outro status.' : 'Nenhuma consulta recebida ainda.');

  mount(
    ctx.root,
    pageHead('Consultas', h('a', { class: 'btn', href: '/api/admin/leads/export.csv' }, icon('download'), 'Exportar CSV')),
    h('div', { class: 'toolbar' }, chips, h('div', { class: 'search' }, h('label', { class: 'visually-hidden', for: 'lead-search' }, 'Buscar consultas'), search)),
    h('div', { class: 'panel flush' }, table),
    data.total > PAGE_SIZE ? pagination(data.page, data.pageSize, data.total, (p) => go(status, q, p)) : null,
  );
  search.id = 'lead-search';
  if (q) {
    search.focus();
    search.setSelectionRange(q.length, q.length);
  }
}

async function findLead(id: string, signal: AbortSignal): Promise<Lead | null> {
  const cached = leadCache.get(id);
  if (cached) return cached;
  try {
    const lead = await api<Lead>('GET', `/leads/${encodeURIComponent(id)}`, undefined, { signal });
    rememberLeads([lead]);
    return lead;
  } catch (err) {
    if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) return null;
    throw err;
  }
}

function dl(label: string, value: string | Node | null): HTMLElement {
  return h('div', { class: 'kv' }, h('dt', null, label), h('dd', null, value || '—'));
}

export async function leadDetailView(ctx: ViewCtx): Promise<void> {
  const id = ctx.params[0] as string;
  const lead = await findLead(id, ctx.signal);
  if (!lead) {
    mount(ctx.root, pageHead('Consulta não encontrada'), emptyState('Esta consulta não existe mais ou foi excluída.', h('a', { class: 'btn', href: '#/consultas' }, 'Voltar para as consultas')));
    return;
  }
  const statusSel = select(STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS[s] })), lead.status);
  const notes = textArea(lead.notes, 5, { maxlength: '4000' });
  const form = h('form', { class: 'stack', novalidate: true });
  const save = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Salvar consulta');
  const baseline = () => `${statusSel.value}|${notes.value}`;
  let base = baseline();
  ctx.setGuard(() => baseline() !== base);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void busy(save, 'Salvando…', async () => {
      try {
        const upd = await api<Lead>('PATCH', `/leads/${encodeURIComponent(lead.id)}`, { status: statusSel.value, notes: notes.value });
        leadCache.set(upd.id, upd);
        base = baseline();
        toast('Consulta atualizada');
      } catch (e) {
        const rest = showFieldErrors(form, (e as { fields?: Record<string, string> }).fields);
        toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
      }
    });
  });
  mount(
    form,
    field('Status', statusSel, { name: 'status' }),
    field('Anotações internas', notes, { name: 'notes', counterMax: 4000, hint: 'Só a equipe vê. Registre contatos, valores combinados e próximos passos.' }),
    h('div', { class: 'form-actions' }, save),
  );

  const digits = lead.phone.replace(/\D/g, '');
  const msg = `Olá, ${lead.name}! Recebemos sua consulta para ${lead.space} em ${fmtDate(lead.eventDate)}.`;
  const actions = h(
    'div',
    { class: 'page-actions' },
    digits ? h('a', { class: 'btn', href: `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener' }, 'Responder no WhatsApp', icon('external')) : null,
    lead.email ? h('a', { class: 'btn', href: `mailto:${lead.email}` }, 'Enviar e-mail') : null,
    isAdmin()
      ? h(
          'button',
          {
            type: 'button',
            class: 'btn btn-danger-ghost',
            onclick: () => {
              void (async () => {
                const ok = await confirmDialog({ title: 'Excluir esta consulta?', message: `A consulta de ${lead.name} será apagada e não poderá ser recuperada.`, confirmLabel: 'Excluir consulta', danger: true });
                if (!ok) return;
                try {
                  await api('DELETE', `/leads/${encodeURIComponent(lead.id)}`);
                  leadCache.delete(lead.id);
                  ctx.setGuard(null);
                  toast('Consulta excluída');
                  ctx.navigate('#/consultas');
                } catch (e) {
                  toast(errorMessage(e), 'error');
                }
              })();
            },
          },
          'Excluir',
        )
      : null,
  );
  const utm = Object.entries(lead.utm ?? {});
  mount(
    ctx.root,
    h('p', { class: 'crumb' }, h('a', { href: '#/consultas' }, 'Consultas'), ' / ', lead.name),
    h('header', { class: 'page-head' }, h('h1', null, lead.name), actions),
    h(
      'div',
      { class: 'grid-2' },
      h(
        'section',
        { class: 'panel' },
        h('h2', null, 'Dados da consulta'),
        h(
          'dl',
          { class: 'kvs' },
          dl('Recebida em', fmtDateTime(lead.createdAt)),
          dl('Telefone', lead.phone),
          dl('E-mail', lead.email),
          dl('Espaço', lead.space),
          dl('Atividade', lead.activity),
          dl('Data pretendida', fmtDate(lead.eventDate)),
          dl('Participantes', lead.people === null ? null : String(lead.people)),
          dl('Modalidade', lead.modality),
          dl('Horário e duração', lead.schedule),
          dl('Detalhes', lead.details),
          dl('Canal', lead.channel),
          dl('Página de origem', lead.page),
          dl('Campanha (UTM)', utm.length ? utm.map(([k, v]) => `${k}: ${v}`).join(' · ') : null),
        ),
      ),
      h('section', { class: 'panel' }, h('h2', null, 'Atendimento'), form),
    ),
  );
}

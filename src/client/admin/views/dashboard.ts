import { LEAD_STATUS } from '../../../shared/catalog';
import type { DashboardData, Lead } from '../../../shared/types';
import { api } from '../api';
import { emptyState, fmtDate, fmtDateTime, h, mount, pageHead } from '../dom';
import type { ViewCtx } from '../router';
import { rememberLeads } from '../state';

export function statusPill(status: Lead['status']): HTMLElement {
  return h('span', { class: `pill pill-${status}` }, LEAD_STATUS[status] ?? status);
}

function stat(label: string, value: string, href?: string): HTMLElement {
  const body = [h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label)];
  return href ? h('a', { class: 'stat', href }, ...body) : h('div', { class: 'stat' }, ...body);
}

export async function dashboardView(ctx: ViewCtx): Promise<void> {
  const d = await api<DashboardData>('GET', '/dashboard', undefined, { signal: ctx.signal });
  rememberLeads(d.recentLeads);
  const recent = d.recentLeads.length
    ? h(
        'ul',
        { class: 'list' },
        d.recentLeads.map((l) =>
          h(
            'li',
            null,
            h(
              'a',
              { class: 'list-row', href: `#/consultas/${encodeURIComponent(l.id)}` },
              h('span', { class: 'list-main' }, h('strong', null, l.name), h('small', null, `${l.space} · ${fmtDate(l.eventDate)}`)),
              h('span', { class: 'list-side' }, statusPill(l.status), h('small', null, fmtDateTime(l.createdAt))),
            ),
          ),
        ),
      )
    : emptyState('Nenhuma consulta recebida ainda.');
  const pending = d.pending.length
    ? h(
        'ul',
        { class: 'list' },
        d.pending.map((p) =>
          h(
            'li',
            null,
            h(
              'a',
              { class: 'list-row', href: `#/salas/${encodeURIComponent(p.roomId)}` },
              h('span', { class: 'list-main' }, h('strong', null, p.roomName), h('small', null, p.issues.join(', '))),
              h('span', { class: 'list-side link' }, 'Completar'),
            ),
          ),
        ),
      )
    : emptyState('Todas as salas estão com os dados completos.');
  mount(
    ctx.root,
    pageHead('Painel'),
    h(
      'div',
      { class: 'stats' },
      stat('Salas publicadas', `${d.rooms.available} de ${d.rooms.total}`, '#/salas'),
      stat('Consultas novas', String(d.leads.new), '#/consultas?status=novo'),
      stat('Consultas nos últimos 7 dias', String(d.leads.last7d), '#/consultas'),
      stat('Consultas nos últimos 30 dias', String(d.leads.last30d), '#/consultas'),
    ),
    h(
      'div',
      { class: 'grid-2' },
      h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Consultas recentes'), h('a', { href: '#/consultas' }, 'Ver todas')), recent),
      h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Salas com dados a completar')), pending),
    ),
  );
}

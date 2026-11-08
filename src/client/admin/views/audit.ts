import type { AuditEntry, Paginated } from '../../../shared/types';
import { api } from '../api';
import { emptyState, fmtDateTime, h, mount, pageHead, pagination } from '../dom';
import type { ViewCtx } from '../router';

const ACTIONS: Record<string, string> = {
  login: 'Entrou no painel',
  login_falhou: 'Login falhou',
  login_bloqueado: 'Login bloqueado',
  sala_criada: 'Criou sala',
  sala_editada: 'Editou sala',
  sala_excluida: 'Excluiu sala',
  sala_publicada: 'Publicou sala',
  sala_ocultada: 'Ocultou sala',
  salas_reordenadas: 'Reordenou salas',
  foto_enviada: 'Enviou foto',
  consulta_atualizada: 'Atualizou consulta',
  consulta_excluida: 'Excluiu consulta',
  consultas_exportadas: 'Exportou consultas',
  configuracoes_salvas: 'Salvou configurações',
  pergunta_criada: 'Criou pergunta',
  pergunta_editada: 'Editou pergunta',
  pergunta_excluida: 'Excluiu pergunta',
  senha_alterada: 'Alterou a senha',
  usuario_criado: 'Criou usuário',
  usuario_editado: 'Editou usuário',
  admin_inicial_criado: 'Criou o administrador inicial',
};

export async function auditView(ctx: ViewCtx): Promise<void> {
  const page = Math.max(1, Number(ctx.query.get('page')) || 1);
  const data = await api<Paginated<AuditEntry>>('GET', `/audit?page=${page}`, undefined, { signal: ctx.signal });
  const heads = ['Data', 'Usuário', 'Ação', 'Alvo', 'IP'];
  const table = data.items.length
    ? h(
        'table',
        { class: 'table stack-table' },
        h('thead', null, h('tr', null, heads.map((c) => h('th', { scope: 'col' }, c)))),
        h(
          'tbody',
          null,
          data.items.map((a) =>
            h(
              'tr',
              { class: a.action === 'login_falhou' || a.action === 'login_bloqueado' ? 'row-danger' : null },
              h('td', { 'data-label': heads[0] as string }, fmtDateTime(a.createdAt)),
              h('td', { 'data-label': heads[1] as string }, a.userEmail ?? '—'),
              h('td', { 'data-label': heads[2] as string }, ACTIONS[a.action] ?? a.action),
              h('td', { 'data-label': heads[3] as string }, a.target || '—'),
              h('td', { 'data-label': heads[4] as string, class: 'mono' }, a.ip || '—'),
            ),
          ),
        ),
      )
    : emptyState('Nenhum registro ainda.');
  mount(
    ctx.root,
    pageHead('Auditoria'),
    h('div', { class: 'panel flush' }, table),
    data.total > data.pageSize ? pagination(data.page, data.pageSize, data.total, (p) => ctx.navigate(`#/auditoria?page=${p}`)) : null,
  );
}

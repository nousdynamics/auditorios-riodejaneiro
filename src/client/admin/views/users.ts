import type { AdminUser, UserRole } from '../../../shared/types';
import { ApiFailure, api, errorMessage } from '../api';
import { busy, field, fmtDateTime, h, modal, mount, pageHead, select, showFieldErrors, textInput, toast, toggle } from '../dom';
import type { ViewCtx } from '../router';
import { getUser } from '../state';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
];

async function resetPassword(user: AdminUser): Promise<void> {
  await modal<boolean>((close) => {
    const pass = textInput('', { type: 'password', autocomplete: 'new-password', required: true });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Redefinir senha');
    const form = h(
      'form',
      { class: 'stack', novalidate: true },
      h('h2', null, `Redefinir senha de ${user.name}`),
      h('p', null, 'A pessoa precisará entrar de novo com a nova senha.'),
      field('Nova senha', pass, { name: 'password', hint: 'Use pelo menos 10 caracteres.' }),
      h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => close(false) }, 'Cancelar'), submit),
    );
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (pass.value.length < 10) {
        showFieldErrors(form, { password: 'Use pelo menos 10 caracteres.' });
        return;
      }
      void busy(submit, 'Salvando…', async () => {
        try {
          await api('PATCH', `/users/${encodeURIComponent(user.id)}`, { password: pass.value });
          toast('Senha redefinida');
          close(true);
        } catch (e) {
          const rest = showFieldErrors(form, e instanceof ApiFailure ? e.fields : undefined);
          toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
        }
      });
    });
    queueMicrotask(() => pass.focus());
    return [form];
  }, 'Redefinir senha');
}

export async function usersView(ctx: ViewCtx): Promise<void> {
  const res = await api<{ items: AdminUser[] }>('GET', '/users', undefined, { signal: ctx.signal });
  let users = res.items;
  const me = getUser();
  const list = h('div', { class: 'panel flush' });

  const patch = async (u: AdminUser, body: { role?: UserRole; isActive?: boolean }): Promise<boolean> => {
    try {
      const upd = await api<AdminUser>('PATCH', `/users/${encodeURIComponent(u.id)}`, body);
      users = users.map((x) => (x.id === upd.id ? upd : x));
      toast('Usuário atualizado');
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    }
  };

  const heads = ['Nome', 'E-mail', 'Perfil', 'Ativo', 'Último acesso', ''];
  function draw() {
    mount(
      list,
      h(
        'table',
        { class: 'table stack-table' },
        h('thead', null, h('tr', null, heads.map((c) => h('th', { scope: 'col' }, c)))),
        h(
          'tbody',
          null,
          users.map((u) => {
            const role = select(ROLES, u.role, { 'aria-label': `Perfil de ${u.name}` });
            role.addEventListener('change', () => {
              void patch(u, { role: role.value as UserRole }).then((ok) => {
                if (!ok) role.value = u.role;
              });
            });
            const act = toggle(u.isActive ? 'Ativo' : 'Inativo', u.isActive);
            act.input.setAttribute('aria-label', `Usuário ${u.name} ativo`);
            act.input.addEventListener('change', () => {
              const want = act.input.checked;
              void patch(u, { isActive: want }).then((ok) => {
                if (!ok) act.input.checked = !want;
                else draw();
              });
            });
            return h(
              'tr',
              null,
              h('td', { 'data-label': heads[0] as string }, u.name, me?.id === u.id ? h('small', { class: 'muted' }, ' (você)') : null),
              h('td', { 'data-label': heads[1] as string }, u.email),
              h('td', { 'data-label': heads[2] as string }, role),
              h('td', { 'data-label': heads[3] as string }, act.el),
              h('td', { 'data-label': heads[4] as string }, u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Nunca entrou'),
              h('td', { 'data-label': heads[5] as string }, h('button', { type: 'button', class: 'btn', onclick: () => void resetPassword(u) }, 'Redefinir senha')),
            );
          }),
        ),
      ),
    );
  }
  draw();

  const name = textInput('', { maxlength: '80', required: true, autocomplete: 'off' });
  const email = textInput('', { type: 'email', maxlength: '120', required: true, autocomplete: 'off' });
  const pass = textInput('', { type: 'password', autocomplete: 'new-password', required: true });
  const role = select(ROLES, 'editor');
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Criar usuário');
  const form = h(
    'form',
    { class: 'panel stack', novalidate: true },
    h('h2', null, 'Novo usuário'),
    h('div', { class: 'grid-form' }, field('Nome', name, { name: 'name', required: true }), field('E-mail', email, { name: 'email', required: true }), field('Senha inicial', pass, { name: 'password', required: true, hint: 'Use pelo menos 10 caracteres.' }), field('Perfil', role, { name: 'role', hint: 'Editores não excluem salas nem consultas e não veem usuários e auditoria.' })),
    h('div', { class: 'form-actions' }, submit),
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    if (!name.value.trim()) local.name = 'Informe o nome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) local.email = 'E-mail inválido. Confira se tem @ e domínio.';
    if (pass.value.length < 10) local.password = 'Use pelo menos 10 caracteres.';
    if (Object.keys(local).length) {
      showFieldErrors(form, local);
      return;
    }
    void busy(submit, 'Criando…', async () => {
      try {
        showFieldErrors(form, {});
        const created = await api<AdminUser>('POST', '/users', { name: name.value.trim(), email: email.value.trim(), password: pass.value, role: role.value });
        users = [...users, created];
        name.value = email.value = pass.value = '';
        draw();
        toast('Usuário criado');
      } catch (e) {
        const rest = showFieldErrors(form, e instanceof ApiFailure ? e.fields : undefined);
        toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
      }
    });
  });
  mount(ctx.root, pageHead('Usuários'), list, form);
}

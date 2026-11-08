import { ApiFailure, api, errorMessage } from '../api';
import { busy, field, h, mount, pageHead, showFieldErrors, textInput, toast } from '../dom';
import type { ViewCtx } from '../router';
import { getUser } from '../state';

export function accountView(ctx: ViewCtx): void {
  const user = getUser();
  const current = textInput('', { type: 'password', autocomplete: 'current-password', required: true });
  const next = textInput('', { type: 'password', autocomplete: 'new-password', required: true });
  const again = textInput('', { type: 'password', autocomplete: 'new-password', required: true });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Alterar senha');
  const form = h(
    'form',
    { class: 'panel stack narrow', novalidate: true },
    h('h2', null, 'Alterar senha'),
    field('Senha atual', current, { name: 'current' }),
    field('Nova senha', next, { name: 'next', hint: 'Use pelo menos 10 caracteres.' }),
    field('Repita a nova senha', again, { name: 'again' }),
    h('p', { class: 'hint' }, 'Depois de alterar, você sai de todos os dispositivos e precisa entrar de novo.'),
    h('div', { class: 'form-actions' }, submit),
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    if (!current.value) local.current = 'Informe a senha atual.';
    if (next.value.length < 10) local.next = 'Use pelo menos 10 caracteres.';
    else if (next.value !== again.value) local.again = 'As senhas não são iguais. Digite a mesma senha nos dois campos.';
    if (Object.keys(local).length) {
      showFieldErrors(form, local);
      return;
    }
    void busy(submit, 'Salvando…', async () => {
      try {
        showFieldErrors(form, {});
        await api('POST', '/password', { current: current.value, next: next.value });
        toast('Senha alterada. Entre novamente com a nova senha.');
        // A sessão foi invalidada no servidor: o próximo pedido cai no login.
        await api('GET', '/dashboard').catch(() => undefined);
      } catch (e) {
        const rest = showFieldErrors(form, e instanceof ApiFailure ? e.fields : undefined);
        toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
      }
    });
  });
  mount(
    ctx.root,
    pageHead('Minha conta'),
    h('section', { class: 'panel narrow' }, h('h2', null, 'Seus dados'), h('p', null, h('strong', null, user?.name ?? ''), h('br'), user?.email ?? ''), h('p', { class: 'muted' }, user?.role === 'admin' ? 'Perfil: administrador' : 'Perfil: editor')),
    form,
  );
}

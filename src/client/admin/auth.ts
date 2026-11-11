import type { AdminUser } from '../../shared/types';
import { ApiFailure, api, errorMessage } from './api';
import { busy, field, h, mount, showFieldErrors, textInput, toast } from './dom';

interface MeResponse {
  user: AdminUser | null;
  needsSetup?: boolean;
  setupEnabled?: boolean;
}

/** Consulta a sessão. Devolve o usuário ou o estado da tela de entrada. */
export async function fetchMe(): Promise<MeResponse> {
  try {
    return await api<MeResponse>('GET', '/me', undefined, { quiet401: true });
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 401) return { user: null };
    throw e;
  }
}

function shell(title: string, ...body: (Node | null)[]): HTMLElement {
  return h(
    'main',
    { class: 'auth' },
    h(
      'div',
      { class: 'auth-card' },
      h('p', { class: 'auth-brand' }, 'Auditório Rio de Janeiro · Painel'),
      h('h1', null, title),
      ...body,
    ),
  );
}

export function renderLogin(app: HTMLElement, onDone: (u: AdminUser) => void, notice?: string): void {
  const email = textInput('', { type: 'email', autocomplete: 'username', required: true });
  const pass = textInput('', { type: 'password', autocomplete: 'current-password', required: true });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Entrar');
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    field('E-mail', email, { name: 'email' }),
    field('Senha', pass, { name: 'password' }),
    submit,
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void busy(submit, 'Entrando…', async () => {
      try {
        const r = await api<{ user: AdminUser }>('POST', '/login', { email: email.value.trim(), password: pass.value }, { quiet401: true });
        onDone(r.user);
      } catch (e) {
        pass.value = '';
        const fe = e as ApiFailure;
        const rest = showFieldErrors(form, fe.fields);
        toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
      }
    });
  });
  mount(app, shell('Entrar no painel', notice ? h('p', { class: 'notice', role: 'status' }, notice) : null, form));
  email.focus();
}

export function renderSetup(app: HTMLElement, enabled: boolean, onDone: (u: AdminUser) => void): void {
  if (!enabled) {
    mount(
      app,
      shell(
        'Configuração inicial',
        h('p', null, 'O painel ainda não tem nenhum administrador. Para criar o primeiro, defina um código de configuração no Cloudflare:'),
        h('pre', { class: 'code' }, 'npx wrangler secret put SETUP_TOKEN'),
        h('p', null, 'Depois de salvar o segredo, recarregue esta página.'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => location.reload() }, 'Recarregar a página'),
      ),
    );
    return;
  }
  const token = textInput('', { type: 'password', autocomplete: 'off', required: true });
  const name = textInput('', { autocomplete: 'name', required: true });
  const email = textInput('', { type: 'email', autocomplete: 'username', required: true });
  const pass = textInput('', { type: 'password', autocomplete: 'new-password', required: true });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Criar administrador');
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    field('Código de configuração', token, { name: 'token', hint: 'O valor que você definiu em SETUP_TOKEN.' }),
    field('Seu nome', name, { name: 'name' }),
    field('E-mail', email, { name: 'email' }),
    field('Senha', pass, { name: 'password', hint: 'Use pelo menos 10 caracteres.' }),
    submit,
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void busy(submit, 'Criando…', async () => {
      try {
        const r = await api<{ user: AdminUser }>('POST', '/setup', {
          token: token.value,
          name: name.value.trim(),
          email: email.value.trim(),
          password: pass.value,
        }, { quiet401: true });
        onDone(r.user);
      } catch (e) {
        const rest = showFieldErrors(form, (e as ApiFailure).fields);
        toast(errorMessage(e) + (rest.length ? ` ${rest.join(' ')}` : ''), 'error');
      }
    });
  });
  mount(app, shell('Criar primeiro administrador', h('p', null, 'Este painel ainda não tem usuários. Cadastre a pessoa que vai administrá-lo.'), form));
  token.focus();
}

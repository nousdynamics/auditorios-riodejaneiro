/** Painel administrativo: ponto de entrada. Monta em #app. */
import type { AdminUser } from '../shared/types';
import { api, setUnauthorizedHandler } from './admin/api';
import { fetchMe, renderLogin, renderSetup } from './admin/auth';
import { busy, h, icon, mount } from './admin/dom';
import { Route, Router, parseHash } from './admin/router';
import { getUser, isAdmin, setUser } from './admin/state';
import { accountView } from './admin/views/account';
import { auditView } from './admin/views/audit';
import { dashboardView } from './admin/views/dashboard';
import { faqsView } from './admin/views/faqs';
import { leadDetailView, leadsView } from './admin/views/leads';
import { roomFormView } from './admin/views/room-form';
import { roomsView } from './admin/views/rooms';
import { settingsView } from './admin/views/settings';
import { usersView } from './admin/views/users';

const app = document.getElementById('app') as HTMLElement;

const ROUTES: Route[] = [
  { pattern: '', view: dashboardView },
  { pattern: 'salas', view: roomsView },
  { pattern: 'salas/nova', view: roomFormView },
  { pattern: 'salas/:id', view: roomFormView },
  { pattern: 'consultas', view: leadsView },
  { pattern: 'consultas/:id', view: leadDetailView },
  { pattern: 'perguntas', view: faqsView },
  { pattern: 'configuracoes', view: settingsView },
  { pattern: 'usuarios', view: usersView, adminOnly: true },
  { pattern: 'conta', view: accountView },
  { pattern: 'auditoria', view: auditView, adminOnly: true },
];

const NAV: { path: string; label: string; adminOnly?: boolean }[] = [
  { path: '', label: 'Painel' },
  { path: 'salas', label: 'Salas' },
  { path: 'consultas', label: 'Consultas' },
  { path: 'perguntas', label: 'Perguntas' },
  { path: 'configuracoes', label: 'Configurações' },
  { path: 'usuarios', label: 'Usuários', adminOnly: true },
  { path: 'auditoria', label: 'Auditoria', adminOnly: true },
  { path: 'conta', label: 'Minha conta' },
];

let router: Router | null = null;
let booted = false;

function showLogin(notice?: string): void {
  setUser(null);
  router?.dispose();
  router = null;
  document.title = 'Entrar · Painel';
  renderLogin(app, (u) => startApp(u), notice);
}

function startApp(user: AdminUser): void {
  router?.dispose();
  setUser(user);
  document.title = 'Painel · Auditório Rio de Janeiro';
  if (!location.hash) location.hash = '#/';
  const main = h('main', { id: 'main', class: 'content', tabindex: '-1' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Principal' });
  const side = h('aside', { class: 'sidebar', id: 'sidebar' });
  const menuBtn = h('button', {
    type: 'button',
    class: 'btn btn-icon menu-btn',
    'aria-label': 'Abrir menu',
    'aria-expanded': 'false',
    'aria-controls': 'sidebar',
    onclick: () => {
      const open = side.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    },
  });
  menuBtn.appendChild(icon('menu'));
  const logout = h('button', { type: 'button', class: 'btn btn-ghost-light' }, 'Sair');
  logout.addEventListener('click', () => {
    void busy(logout, 'Saindo…', async () => {
      try {
        await api('POST', '/logout', {});
      } catch {
        /* sessão já expirada */
      }
      showLogin();
    });
  });

  for (const item of NAV) {
    if (item.adminOnly && user.role !== 'admin') continue;
    nav.appendChild(h('a', { href: `#/${item.path}`, 'data-path': item.path, onclick: () => closeMenu() }, item.label));
  }
  const closeMenu = () => {
    side.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  };
  side.append(
    h('div', { class: 'brand' }, h('strong', null, 'Auditório Rio de Janeiro'), h('span', null, ' · Painel')),
    nav,
    h('div', { class: 'side-foot' }, h('p', { class: 'who' }, user.name, h('small', null, user.role === 'admin' ? 'Administrador' : 'Editor')), logout),
  );
  mount(
    app,
    h('a', { class: 'skip', href: '#main', onclick: (e: Event) => { e.preventDefault(); main.focus(); } }, 'Ir para o conteúdo'),
    h('header', { class: 'topbar' }, menuBtn, h('span', { class: 'brand-sm' }, 'Auditório RJ · Painel')),
    side,
    main,
  );

  const markActive = () => {
    const first = parseHash().segs[0] ?? '';
    nav.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
      if (a.dataset.path === first) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    closeMenu();
  };
  // Senha temporária: o painel inteiro vira a tela de troca de senha
  const routes = user.mustChangePassword
    ? [
        { pattern: '', view: accountView },
        { pattern: 'conta', view: accountView },
      ]
    : ROUTES;
  router = new Router(main, routes, isAdmin, markActive);
  void router.render();
}

setUnauthorizedHandler(() => {
  if (getUser()) showLogin('Sua sessão terminou. Entre novamente para continuar.');
});

async function boot(): Promise<void> {
  if (booted) return;
  booted = true;
  try {
    const me = await fetchMe();
    if (me.user) startApp(me.user);
    else if (me.needsSetup) renderSetup(app, Boolean(me.setupEnabled), (u) => startApp(u));
    else showLogin();
  } catch {
    mount(
      app,
      h(
        'main',
        { class: 'auth' },
        h(
          'div',
          { class: 'auth-card' },
          h('h1', null, 'Não foi possível abrir o painel'),
          h('p', null, 'O servidor não respondeu. Verifique sua conexão e tente de novo.'),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => location.reload() }, 'Tentar de novo'),
        ),
      ),
    );
  }
}

void boot();

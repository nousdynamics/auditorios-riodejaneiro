import { clear, confirmDialog, h } from './dom';
import { ApiFailure, errorMessage, isAbort } from './api';

export interface ViewCtx {
  root: HTMLElement;
  params: string[];
  query: URLSearchParams;
  signal: AbortSignal;
  /** Registra uma função que diz se há alterações não salvas. */
  setGuard(dirty: (() => boolean) | null): void;
  navigate(hash: string): void;
}
export type View = (ctx: ViewCtx) => Promise<void> | void;

export interface Route {
  /** Padrão, ex.: "salas/:id" */
  pattern: string;
  view: View;
  adminOnly?: boolean;
}

export function parseHash(): { segs: string[]; query: URLSearchParams } {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path = '', qs = ''] = raw.split('?');
  return { segs: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs) };
}

function match(pattern: string, segs: string[]): string[] | null {
  const ps = pattern.split('/').filter(Boolean);
  if (ps.length !== segs.length) return null;
  const params: string[] = [];
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i] as string;
    if (p.startsWith(':')) params.push(segs[i] as string);
    else if (p !== segs[i]) return null;
  }
  return params;
}

export class Router {
  private ctrl: AbortController | null = null;
  private dirty: (() => boolean) | null = null;
  private current = location.hash;
  private suppress = false;

  constructor(
    private root: HTMLElement,
    private routes: Route[],
    private isAdmin: () => boolean,
    private onChange: () => void,
  ) {
    window.addEventListener('hashchange', this.hashListener);
    window.addEventListener('beforeunload', this.unloadListener);
  }

  private hashListener = (): void => void this.onHash();
  private unloadListener = (e: BeforeUnloadEvent): void => {
    if (this.dirty?.()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  dispose(): void {
    this.ctrl?.abort();
    window.removeEventListener('hashchange', this.hashListener);
    window.removeEventListener('beforeunload', this.unloadListener);
  }

  private async onHash(): Promise<void> {
    if (this.suppress) {
      this.suppress = false;
      return;
    }
    const target = location.hash;
    if (this.dirty?.()) {
      history.replaceState(null, '', this.current || '#/');
      const leave = await confirmDialog({
        title: 'Sair sem salvar?',
        message: 'Você fez alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.',
        confirmLabel: 'Sair sem salvar',
        danger: true,
      });
      if (!leave) return;
      this.dirty = null;
      this.suppress = true;
      location.hash = target;
    }
    await this.render();
  }

  async render(): Promise<void> {
    this.ctrl?.abort();
    const ctrl = new AbortController();
    this.ctrl = ctrl;
    this.dirty = null;
    this.current = location.hash;
    const { segs, query } = parseHash();
    let params: string[] = [];
    let route = this.routes.find((r) => {
      const m = match(r.pattern, segs);
      if (m) params = m;
      return Boolean(m);
    });
    if (route?.adminOnly && !this.isAdmin()) route = undefined;
    this.onChange();
    clear(this.root);
    window.scrollTo(0, 0);
    if (!route) {
      if (segs.length) location.hash = '#/';
      return;
    }
    const ctx: ViewCtx = {
      root: this.root,
      params,
      query,
      signal: ctrl.signal,
      setGuard: (d) => {
        this.dirty = d;
      },
      navigate: (hash) => {
        location.hash = hash;
      },
    };
    this.root.setAttribute('aria-busy', 'true');
    try {
      await route.view(ctx);
    } catch (e) {
      if (isAbort(e) || ctrl.signal.aborted) return;
      if (e instanceof ApiFailure && e.status === 401) return;
      clear(this.root);
      this.root.appendChild(
        h(
          'div',
          { class: 'panel error-panel', role: 'alert' },
          h('h1', null, 'Não foi possível carregar esta tela'),
          h('p', null, errorMessage(e)),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => void this.render() }, 'Tentar de novo'),
        ),
      );
    } finally {
      this.root.removeAttribute('aria-busy');
    }
  }
}

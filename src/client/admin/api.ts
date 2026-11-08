import type { ApiError } from '../../shared/types';

export class ApiFailure extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => undefined;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export interface ApiOpts {
  signal?: AbortSignal;
  /** Não dispara a tela de login em 401 (usado em /me e /login). */
  quiet401?: boolean;
}

export async function api<T>(method: string, path: string, body?: unknown, opts: ApiOpts = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'fetch', Accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, { method, headers, body: payload, credentials: 'same-origin', signal: opts.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiFailure(0, 'Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && !opts.quiet401) onUnauthorized();
  if (!res.ok) {
    const e = (data ?? {}) as Partial<ApiError>;
    throw new ApiFailure(res.status, e.error || `Erro ${res.status}. Tente novamente em instantes.`, e.fields);
  }
  return data as T;
}

export const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.';
}

import type { ApiError } from '../../shared/types';
import type { SafeHtml } from './html';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const CSP_SITE = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'inline-speculation-rules'",
  "connect-src 'self'",
  'frame-src https://www.google.com https://maps.google.com',
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

export function securityHeaders(headers: Headers, { csp = CSP_SITE }: { csp?: string } = {}): Headers {
  headers.set('Content-Security-Policy', csp);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return headers;
}

export function htmlResponse(
  body: SafeHtml | string,
  init: { status?: number; cacheSeconds?: number; noindex?: boolean; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  // Navegador revalida sempre (conteúdo vem do painel); a borda pode servir cópia curta.
  headers.set(
    'Cache-Control',
    init.cacheSeconds ? `public, max-age=0, s-maxage=${init.cacheSeconds}, stale-while-revalidate=600` : 'no-store',
  );
  if (init.noindex) headers.set('X-Robots-Tag', 'noindex, nofollow');
  securityHeaders(headers);
  return new Response(String(body), { status: init.status ?? 200, headers });
}

export function json(data: unknown, init: { status?: number; headers?: HeadersInit } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(data), { status: init.status ?? 200, headers });
}

export function errorJson(err: unknown): Response {
  if (err instanceof HttpError) {
    const body: ApiError = { error: err.message };
    if (err.fields) body.fields = err.fields;
    return json(body, { status: err.status });
  }
  console.error('Erro inesperado', err);
  return json({ error: 'Erro interno. Tente de novo em instantes.' } satisfies ApiError, { status: 500 });
}

export function text(body: string, contentType: string, cacheSeconds = 3600): Response {
  return new Response(body, {
    headers: {
      'Content-Type': `${contentType}; charset=utf-8`,
      'Cache-Control': `public, max-age=${cacheSeconds}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Lê JSON do corpo com limite de tamanho. */
export async function readJson<T>(request: Request, maxBytes = 64_000): Promise<T> {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Envie os dados em JSON.');
  const len = Number(request.headers.get('Content-Length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'Dados grandes demais.');
  const body = await request.text();
  if (body.length > maxBytes) throw new HttpError(413, 'Dados grandes demais.');
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? '';
}

/** Mutação só vale vinda do próprio site (proteção CSRF junto com SameSite=Strict). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  if (origin && origin !== url.origin) throw new HttpError(403, 'Origem não permitida.');
  if (!origin) {
    const fetchSite = request.headers.get('Sec-Fetch-Site');
    if (fetchSite && fetchSite !== 'same-origin') throw new HttpError(403, 'Origem não permitida.');
  }
}

export function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

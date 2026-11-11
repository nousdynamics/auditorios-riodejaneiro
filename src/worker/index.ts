/**
 * Worker principal: páginas (SSR), API pública, API do painel, mídia do R2 e arquivos de SEO.
 * Arquivos estáticos (public/) são servidos antes, direto pela borda, sem passar por aqui.
 */
import { handleAdminApi } from './api/admin';
import { handleLead } from './api/public';
import { SCHEMA_VERSION, ensureDatabase } from './db/bootstrap';
import { getSiteData } from './data';
import { htmlResponse, json, redirect, securityHeaders, siteCsp, text } from './lib/http';
import { randomToken } from './lib/crypto';
import { serveMedia, serveVideo } from './media';
import { llmsTxt, robotsTxt, sitemapXml } from './seo/files';
import { homePage } from './views/home';
import type { RenderCtx } from './views/layout';
import { adminShell, corporatePage, notFoundPage, privacyPage, roomPage, roomsPage } from './views/pages';

const ADMIN_CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

/** true = dentro do limite (ou limitador ausente, como em testes). */
async function withinLimit(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch {
    return true; // falha do limitador nunca derruba o site
  }
}

const tooManyRequests = () =>
  json({ error: 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.' }, { status: 429, headers: { 'Retry-After': '60' } });

function siteBase(env: Env, url: URL): string {
  return (env.SITE_URL || url.origin).replace(/\/+$/, '');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;
    const method = request.method.toUpperCase();

    // URLs canônicas: sem barra final e em minúsculas (exceto mídia/API)
    if (path.length > 1 && path.endsWith('/') && !path.startsWith('/api/')) {
      return redirect(path.replace(/\/+$/, '') + url.search, 301);
    }
    if (/[A-Z]/.test(path) && !path.startsWith('/media/') && !path.startsWith('/api/')) {
      return redirect(path.toLowerCase() + url.search, 301);
    }

    // Domínio único: o endereço *.workers.dev não passa pelas regras de segurança do domínio
    // (WAF, bots, Access). Páginas redirecionam; envios e API são recusados.
    const canonical = env.SITE_URL ? new URL(env.SITE_URL) : null;
    if (canonical && url.hostname.endsWith('.workers.dev') && url.host !== canonical.host) {
      if (method === 'GET' || method === 'HEAD') return redirect(canonical.origin + path + url.search, 301);
      return json({ error: `Use ${canonical.origin}.` }, { status: 403 });
    }

    if (path.startsWith('/assets/video/')) return serveVideo(request, env);

    try {
      await ensureDatabase(env.DB);
    } catch (err) {
      console.error('Falha ao preparar o banco', err);
      return htmlResponse('<h1>Site em manutenção</h1><p>Tente de novo em instantes.</p>', { status: 503 });
    }

    // ---------------- API ----------------
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
    if (path.startsWith('/api/admin')) {
      const sensitive = method === 'POST' && (path === '/api/admin/login' || path === '/api/admin/setup' || path === '/api/admin/password');
      if (sensitive && !(await withinLimit(env.LOGIN_LIMIT, `${path}:${ip}`))) return tooManyRequests();
      if (!(await withinLimit(env.ADMIN_API_LIMIT, ip))) return tooManyRequests();
      return handleAdminApi(request, env, url);
    }
    if (path === '/api/leads') {
      if (method !== 'POST') return json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
      if (!(await withinLimit(env.LEADS_LIMIT, ip))) return tooManyRequests();
      return handleLead(request, env, ctx, siteBase(env, url));
    }
    if (path === '/api/health') {
      // Só diz se cada destino está configurado (nunca as URLs).
      return json({
        ok: true,
        time: new Date().toISOString(),
        schema: SCHEMA_VERSION,
        webhooks: { n8n: Boolean(env.LEADS_WEBHOOK_URL?.trim()), trafficEngine: Boolean(env.TRAFFIC_LEADS_WEBHOOK_URL?.trim()) },
      });
    }
    if (path.startsWith('/api/')) return json({ error: 'Rota não encontrada.' }, { status: 404 });

    // ---------------- Mídia (R2) ----------------
    if (path.startsWith('/media/')) {
      if (method !== 'GET' && method !== 'HEAD') return new Response(null, { status: 405 });
      return serveMedia(request, env, decodeURIComponent(path.slice('/media/'.length)));
    }

    if (method !== 'GET' && method !== 'HEAD') return new Response('Método não permitido', { status: 405, headers: { Allow: 'GET, HEAD' } });

    // ---------------- Painel ----------------
    if (path === '/admin' || path.startsWith('/admin/')) {
      const res = htmlResponse(adminShell(), { noindex: true });
      securityHeaders(res.headers, { csp: ADMIN_CSP });
      return res;
    }

    const base = siteBase(env, url);
    const data = await getSiteData(env);

    // ---------------- SEO ----------------
    if (path === '/robots.txt') return text(robotsTxt(base), 'text/plain', 3600);
    if (path === '/sitemap.xml') return text(sitemapXml(base, data), 'application/xml', 3600);
    if (path === '/llms.txt') return text(llmsTxt(base, data), 'text/markdown', 3600);
    if (path === '/llms-full.txt') return text(llmsTxt(base, data, true), 'text/markdown', 3600);

    // ---------------- Páginas ----------------
    const nonce = randomToken(16);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    const gtmId = env.GTM_ID && /^GTM-[A-Z0-9]{4,12}$/.test(env.GTM_ID) && !isLocal ? env.GTM_ID : undefined;
    const render: RenderCtx = { base, settings: data.settings, path, nonce, gtmId };
    const page = (body: ReturnType<typeof homePage>, status = 200) =>
      htmlResponse(body, { status, cacheSeconds: status === 200 ? 60 : 0, csp: siteCsp(nonce) });

    if (path === '/') return page(homePage(render, data));
    if (path === '/auditorios') return page(roomsPage(render, data));
    if (path === '/pacote-corporativo') return page(corporatePage(render, data));
    if (path === '/politica-de-privacidade') return page(privacyPage(render));

    const roomMatch = path.match(/^\/auditorios\/([a-z0-9-]+)$/);
    if (roomMatch) {
      const room = data.rooms.find((r) => r.slug === roomMatch[1]);
      if (room) return page(roomPage(render, data, room));
    }

    // Endereços do site antigo (one-page) → páginas novas
    const legacy: Record<string, string> = { '/index.html': '/', '/salas': '/auditorios', '/corporativo': '/pacote-corporativo', '/contato': '/#consulta' };
    if (legacy[path]) return redirect(legacy[path], 301);

    return page(notFoundPage(render, data.rooms), 404);
  },
} satisfies ExportedHandler<Env>;

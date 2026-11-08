import * as repo from './db/repo';
import { DUMMY_HASH, randomToken, sha256Hex, verifyPassword } from './lib/crypto';
import { HttpError, clientIp } from './lib/http';

export const SESSION_COOKIE = '__Host-adm';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 h

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSec: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
}

export async function currentUser(request: Request, env: Env): Promise<repo.UserRecord | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || token.length < 20 || token.length > 100) return null;
  return repo.getSessionUser(env.DB, await sha256Hex(token));
}

export async function requireUser(request: Request, env: Env, role?: 'admin'): Promise<repo.UserRecord> {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, 'Sua sessão expirou. Entre de novo.');
  if (role === 'admin' && user.role !== 'admin') throw new HttpError(403, 'Apenas administradores podem fazer isso.');
  return user;
}

/** Login com bloqueio progressivo por e-mail e por IP. Devolve o cabeçalho Set-Cookie. */
export async function login(request: Request, env: Env, email: string, password: string) {
  const ip = clientIp(request);
  const normalized = email.trim().toLowerCase();
  const byIp = await repo.hitRateLimit(env.DB, `login-ip:${ip}`, { limit: 20, windowMs: 15 * 60_000, lockMs: 15 * 60_000 });
  const byEmail = await repo.hitRateLimit(env.DB, `login-email:${normalized}`, { limit: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 });
  if (!byIp.allowed || !byEmail.allowed) {
    await repo.audit(env.DB, { action: 'login_bloqueado', target: normalized, ip });
    const wait = Math.max(byIp.retryAfterSec, byEmail.retryAfterSec);
    throw new HttpError(429, `Muitas tentativas. Tente de novo em ${Math.ceil(wait / 60)} min.`);
  }

  const user = await repo.findUserByEmail(env.DB, normalized);
  // Verifica sempre (mesmo sem usuário) para não revelar quais e-mails existem pelo tempo de resposta.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    await repo.audit(env.DB, { action: 'login_falhou', target: normalized, ip });
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }

  await repo.clearRateLimit(env.DB, `login-email:${normalized}`);
  const token = randomToken(32);
  await repo.createSession(env.DB, {
    id: await sha256Hex(token),
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
    ip,
    userAgent: request.headers.get('User-Agent') ?? '',
  });
  await repo.touchLogin(env.DB, user.id);
  await repo.audit(env.DB, { userId: user.id, userEmail: user.email, action: 'login', ip });
  return { user, cookie: sessionCookie(token, SESSION_TTL_MS / 1000) };
}

export async function logout(request: Request, env: Env): Promise<string> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await repo.deleteSession(env.DB, await sha256Hex(token));
  return sessionCookie('', 0);
}

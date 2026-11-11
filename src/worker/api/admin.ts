/**
 * API do painel (/api/admin/*). JSON, sessão por cookie HttpOnly + SameSite=Strict,
 * mutações exigem mesma origem e o header `X-Requested-With: fetch`.
 */
import { LEAD_STATUS } from '../../shared/catalog';
import type { DashboardData, Room } from '../../shared/types';
import { currentUser, login, logout, requireUser } from '../auth';
import { isTemporaryPassword } from '../db/initial-admin';
import * as repo from '../db/repo';
import { invalidateSiteData } from '../data';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { HttpError, assertSameOrigin, clientIp, errorJson, json, readJson } from '../lib/http';
import { deleteR2Photos, handleUpload } from '../media';
import { validateFaq, validateLeadPatch, validateNewUser, validatePassword, validateRoom, validateSettings } from '../validate';

type Ctx = { request: Request; env: Env; url: URL; ip: string };

export async function handleAdminApi(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      assertSameOrigin(request);
      if (request.headers.get('X-Requested-With') !== 'fetch') throw new HttpError(403, 'Requisição não permitida.');
    }
    const path = url.pathname.replace(/^\/api\/admin/, '') || '/';
    const ctx: Ctx = { request, env, url, ip: clientIp(request) };
    return await route(method, path, ctx);
  } catch (err) {
    return errorJson(err);
  }
}

async function route(method: string, path: string, ctx: Ctx): Promise<Response> {
  const { request, env } = ctx;
  const seg = path.split('/').filter(Boolean);

  // ---------------- Sessão ----------------
  if (path === '/login' && method === 'POST') {
    const body = await readJson<{ email?: string; password?: string }>(request, 4000);
    if (!body.email || !body.password) throw new HttpError(422, 'Informe e-mail e senha.');
    const { user, cookie } = await login(request, env, body.email, body.password);
    return json({ user: clientUser(user) }, { headers: { 'Set-Cookie': cookie } });
  }
  if (path === '/logout' && method === 'POST') {
    return json({ ok: true }, { headers: { 'Set-Cookie': await logout(request, env) } });
  }
  if (path === '/setup' && method === 'POST') return setup(ctx);
  if (path === '/me' && method === 'GET') {
    const user = await currentUser(request, env);
    const needsSetup = !user && (await repo.countUsers(env.DB)) === 0;
    // 200 mesmo sem sessão: o painel decide entre login e configuração inicial
    if (!user) return json({ user: null, needsSetup, setupEnabled: needsSetup && Boolean(env.SETUP_TOKEN) });
    return json({ user: clientUser(user) });
  }

  const user = await requireUser(request, env);
  // Senha temporária: até trocar, só a troca de senha fica liberada
  if (isTemporaryPassword(user.passwordHash) && path !== '/password') {
    throw new HttpError(403, 'Troque a senha temporária para continuar.');
  }
  const log = (action: string, target = '', meta: Record<string, unknown> = {}) =>
    repo.audit(env.DB, { userId: user.id, userEmail: user.email, action, target, meta, ip: ctx.ip });

  // ---------------- Painel ----------------
  if (path === '/dashboard' && method === 'GET') {
    const rooms = await repo.listRooms(env.DB);
    const data: DashboardData = {
      rooms: { total: rooms.length, available: rooms.filter((r) => r.isAvailable).length, featured: rooms.filter((r) => r.isFeatured).length },
      leads: await repo.leadStats(env.DB),
      recentLeads: await repo.recentLeads(env.DB, 6),
      pending: rooms.map((r) => ({ roomId: r.id, roomName: r.name, issues: roomIssues(r) })).filter((p) => p.issues.length),
    };
    return json(data);
  }

  // ---------------- Salas ----------------
  if (seg[0] === 'rooms') {
    if (seg.length === 1 && method === 'GET') return json({ items: await repo.listRooms(env.DB) });
    if (seg.length === 1 && method === 'POST') {
      const input = validateRoom(await readJson(request));
      const room = await repo.createRoom(env.DB, input);
      invalidateSiteData();
      await log('sala_criada', room.name, { id: room.id });
      return json(room, { status: 201 });
    }
    if (seg[1] === 'reorder' && method === 'POST') {
      const { ids } = await readJson<{ ids?: unknown }>(request);
      if (!Array.isArray(ids) || !ids.every((i) => typeof i === 'string')) throw new HttpError(422, 'Ordem inválida.');
      await repo.reorder(env.DB, 'rooms', ids as string[]);
      invalidateSiteData();
      await log('salas_reordenadas');
      return json({ ok: true });
    }
    const id = seg[1];
    if (id && seg.length === 2) {
      if (method === 'GET') {
        const room = await repo.getRoom(env.DB, id);
        if (!room) throw new HttpError(404, 'Sala não encontrada.');
        return json(room);
      }
      if (method === 'PUT') {
        const input = validateRoom(await readJson(request));
        const before = await repo.getRoom(env.DB, id);
        const room = await repo.updateRoom(env.DB, id, input);
        if (before) {
          const kept = new Set(room.photos.map((p) => p.src));
          await deleteR2Photos(env, before.photos.filter((p) => !kept.has(p.src)));
        }
        invalidateSiteData();
        await log('sala_editada', room.name, { id });
        return json(room);
      }
      if (method === 'DELETE') {
        if (user.role !== 'admin') throw new HttpError(403, 'Apenas administradores podem excluir salas.');
        const room = await repo.deleteRoom(env.DB, id);
        await deleteR2Photos(env, room.photos);
        invalidateSiteData();
        await log('sala_excluida', room.name, { id });
        return json({ ok: true });
      }
    }
    if (id && seg[2] === 'availability' && method === 'PATCH') {
      const { isAvailable } = await readJson<{ isAvailable?: unknown }>(request);
      if (typeof isAvailable !== 'boolean') throw new HttpError(422, 'Informe isAvailable.');
      const room = await repo.setRoomAvailability(env.DB, id, isAvailable);
      invalidateSiteData();
      await log(isAvailable ? 'sala_publicada' : 'sala_ocultada', room.name, { id });
      return json(room);
    }
  }

  // ---------------- Upload de fotos ----------------
  if (path === '/uploads' && method === 'POST') {
    const photo = await handleUpload(request, env);
    await log('foto_enviada', photo.src);
    return json(photo, { status: 201 });
  }

  // ---------------- Consultas (leads) ----------------
  if (seg[0] === 'leads') {
    if (seg.length === 1 && method === 'GET') {
      const q = ctx.url.searchParams;
      const status = q.get('status') ?? '';
      return json(
        await repo.listLeads(env.DB, {
          status: status in LEAD_STATUS ? status : undefined,
          q: (q.get('q') ?? '').slice(0, 80) || undefined,
          page: Math.max(1, Number(q.get('page')) || 1),
          pageSize: Math.min(100, Math.max(5, Number(q.get('pageSize')) || 25)),
        }),
      );
    }
    if (seg[1] === 'export.csv' && method === 'GET') {
      const leads = await repo.allLeads(env.DB);
      await log('consultas_exportadas', '', { total: leads.length });
      return new Response(toCsv(leads), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="consultas-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    const id = seg[1];
    if (id && method === 'GET') {
      const lead = await repo.getLead(env.DB, id);
      if (!lead) throw new HttpError(404, 'Consulta não encontrada.');
      return json(lead);
    }
    if (id && method === 'PATCH') {
      const lead = await repo.updateLead(env.DB, id, validateLeadPatch(await readJson(request)));
      await log('consulta_atualizada', lead.name, { id, status: lead.status });
      return json(lead);
    }
    if (id && method === 'DELETE') {
      if (user.role !== 'admin') throw new HttpError(403, 'Apenas administradores podem excluir consultas.');
      await repo.deleteLead(env.DB, id);
      await log('consulta_excluida', '', { id });
      return json({ ok: true });
    }
  }

  // ---------------- Configurações ----------------
  if (path === '/settings') {
    if (method === 'GET') return json(await repo.getSettings(env.DB));
    if (method === 'PUT') {
      const saved = await repo.saveSettings(env.DB, validateSettings(await readJson(request)));
      invalidateSiteData();
      await log('configuracoes_salvas');
      return json(saved);
    }
  }

  // ---------------- FAQ ----------------
  if (seg[0] === 'faqs') {
    if (seg.length === 1 && method === 'GET') return json({ items: await repo.listFaqs(env.DB) });
    if (seg.length === 1 && method === 'POST') {
      const faq = await repo.createFaq(env.DB, validateFaq(await readJson(request)));
      invalidateSiteData();
      await log('pergunta_criada', faq.question);
      return json(faq, { status: 201 });
    }
    if (seg[1] === 'reorder' && method === 'POST') {
      const { ids } = await readJson<{ ids?: unknown }>(request);
      if (!Array.isArray(ids) || !ids.every((i) => typeof i === 'string')) throw new HttpError(422, 'Ordem inválida.');
      await repo.reorder(env.DB, 'faqs', ids as string[]);
      invalidateSiteData();
      return json({ ok: true });
    }
    const id = seg[1];
    if (id && method === 'PUT') {
      const faq = await repo.updateFaq(env.DB, id, validateFaq(await readJson(request)));
      invalidateSiteData();
      await log('pergunta_editada', faq.question);
      return json(faq);
    }
    if (id && method === 'DELETE') {
      await repo.deleteFaq(env.DB, id);
      invalidateSiteData();
      await log('pergunta_excluida', '', { id });
      return json({ ok: true });
    }
  }

  // ---------------- Usuários ----------------
  if (path === '/password' && method === 'POST') {
    const body = await readJson<{ current?: string; next?: string }>(request, 4000);
    if (!body.current || !(await verifyPassword(body.current, user.passwordHash))) {
      throw new HttpError(422, 'Senha atual incorreta.', { current: 'Senha atual incorreta.' });
    }
    const next = validatePassword(body.next, 'next');
    if (body.next === body.current) throw new HttpError(422, 'Escolha uma senha diferente da atual.', { next: 'Escolha uma senha diferente da atual.' });
    await repo.updateUser(env.DB, user.id, { passwordHash: await hashPassword(next) });
    await log('senha_alterada');
    // updateUser já encerrou todas as sessões do usuário; limpa também o cookie
    return json({ ok: true, relogin: true }, { headers: { 'Set-Cookie': await logout(request, env) } });
  }
  if (seg[0] === 'users') {
    await requireUser(request, env, 'admin');
    if (seg.length === 1 && method === 'GET') return json({ items: await repo.listUsers(env.DB) });
    if (seg.length === 1 && method === 'POST') {
      const data = validateNewUser(await readJson(request, 4000));
      const created = await repo.createUser(env.DB, { ...data, passwordHash: await hashPassword(data.password) });
      await log('usuario_criado', created.email, { role: created.role });
      return json(created, { status: 201 });
    }
    const id = seg[1];
    if (id && method === 'PATCH') {
      const body = await readJson<{ role?: unknown; isActive?: unknown; password?: unknown }>(request, 4000);
      const patch: Parameters<typeof repo.updateUser>[2] = {};
      if (body.role === 'admin' || body.role === 'editor') patch.role = body.role;
      if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;
      if (body.password !== undefined) patch.passwordHash = await hashPassword(validatePassword(body.password));
      const target = await repo.findUserById(env.DB, id);
      if (!target) throw new HttpError(404, 'Usuário não encontrado.');
      const losingAdmin = target.role === 'admin' && target.isActive && (patch.role === 'editor' || patch.isActive === false);
      if (losingAdmin && (await repo.countActiveAdmins(env.DB)) <= 1) {
        throw new HttpError(422, 'O painel precisa de pelo menos um administrador ativo.');
      }
      const updated = await repo.updateUser(env.DB, id, patch);
      await log('usuario_editado', updated.email, { role: patch.role, isActive: patch.isActive, senha: Boolean(patch.passwordHash) });
      return json(updated);
    }
  }

  // ---------------- Auditoria ----------------
  if (path === '/audit' && method === 'GET') {
    await requireUser(request, env, 'admin');
    return json(await repo.listAudit(env.DB, Math.max(1, Number(ctx.url.searchParams.get('page')) || 1)));
  }

  throw new HttpError(404, 'Rota não encontrada.');
}

/** Cria o primeiro administrador. Só funciona sem usuários e com o segredo SETUP_TOKEN. */
async function setup({ request, env, ip }: Ctx): Promise<Response> {
  if (!env.SETUP_TOKEN) throw new HttpError(403, 'Configuração inicial desativada. Defina o segredo SETUP_TOKEN no Cloudflare.');
  if ((await repo.countUsers(env.DB)) > 0) throw new HttpError(409, 'O painel já tem um administrador.');
  const limit = await repo.hitRateLimit(env.DB, `setup:${ip}`, { limit: 5, windowMs: 15 * 60_000, lockMs: 30 * 60_000 });
  if (!limit.allowed) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
  const body = await readJson<Record<string, unknown>>(request, 4000);
  if (typeof body.token !== 'string' || body.token !== env.SETUP_TOKEN) throw new HttpError(403, 'Código de configuração incorreto.', { token: 'Código incorreto.' });
  const data = validateNewUser({ ...body, role: 'admin' });
  const user = await repo.createUser(env.DB, { ...data, role: 'admin', passwordHash: await hashPassword(data.password) });
  await repo.audit(env.DB, { userId: user.id, userEmail: user.email, action: 'admin_inicial_criado', ip });
  const session = await login(request, env, data.email, data.password);
  return json({ user }, { status: 201, headers: { 'Set-Cookie': session.cookie } });
}

function roomIssues(r: Room): string[] {
  const issues: string[] = [];
  if (!r.photos.length) issues.push('sem fotos');
  if (r.areaM2 === null) issues.push('área não informada');
  if (r.capacityMin === 30 && r.capacityMax === 50) issues.push('capacidade genérica (30–50): confirme a da sala');
  if (!r.floor) issues.push('andar não informado');
  if (r.description.length < 120) issues.push('descrição curta');
  return issues;
}

function toCsv(leads: Awaited<ReturnType<typeof repo.allLeads>>): string {
  const cols = ['createdAt', 'status', 'name', 'phone', 'email', 'space', 'activity', 'eventDate', 'people', 'modality', 'schedule', 'details', 'channel', 'notes', 'page'] as const;
  const head = ['Recebida em', 'Status', 'Nome', 'Telefone', 'E-mail', 'Espaço', 'Atividade', 'Data', 'Participantes', 'Modalidade', 'Horário', 'Detalhes', 'Canal', 'Anotações', 'Página'];
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita injeção de fórmula em planilhas
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = leads.map((l) => cols.map((c) => cell(c === 'status' ? LEAD_STATUS[l.status] : l[c])).join(';'));
  return '﻿' + [head.map(cell).join(';'), ...rows].join('\r\n');
}

/** Usuário como o painel recebe: sem o hash e com o aviso de senha temporária. */
function clientUser(u: Parameters<typeof repo.publicUser>[0]) {
  return { ...repo.publicUser(u), mustChangePassword: isTemporaryPassword(u.passwordHash) };
}

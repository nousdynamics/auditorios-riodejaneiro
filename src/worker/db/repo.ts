import type {
  AdminUser,
  AuditEntry,
  Faq,
  FaqInput,
  Lead,
  LeadChannel,
  LeadStatus,
  Paginated,
  Room,
  RoomInput,
  SiteSettings,
  UserRole,
} from '../../shared/types';
import { newId } from '../lib/crypto';
import { HttpError } from '../lib/http';
import { DEFAULT_SETTINGS } from './seed';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Mescla profunda simples: garante que campos novos de SiteSettings tenham valor padrão. */
function withDefaults<T>(defaults: T, value: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(value) ? value : defaults) as T;
  if (defaults && typeof defaults === 'object') {
    const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = k in out ? withDefaults(out[k], v) : v;
      }
    }
    return out as T;
  }
  return (value === undefined ? defaults : value) as T;
}

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

type RoomRow = Record<string, unknown>;

export function mapRoom(r: RoomRow): Room {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    tagline: String(r.tagline ?? ''),
    summary: String(r.summary ?? ''),
    description: String(r.description ?? ''),
    roomType: String(r.room_type ?? 'Auditório'),
    floor: String(r.floor ?? ''),
    capacityMin: r.capacity_min == null ? null : Number(r.capacity_min),
    capacityMax: Number(r.capacity_max ?? 0),
    areaM2: r.area_m2 == null ? null : Number(r.area_m2),
    layouts: parseJson(r.layouts, {}),
    amenities: parseJson(r.amenities, []),
    photos: parseJson(r.photos, []),
    priceHour: r.price_hour == null ? null : Number(r.price_hour),
    priceShift: r.price_shift == null ? null : Number(r.price_shift),
    priceDay: r.price_day == null ? null : Number(r.price_day),
    showPrices: Boolean(r.show_prices),
    isAvailable: Boolean(r.is_available),
    isFeatured: Boolean(r.is_featured),
    sortOrder: Number(r.sort_order ?? 0),
    seoTitle: String(r.seo_title ?? ''),
    seoDescription: String(r.seo_description ?? ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listRooms(db: D1Database, { onlyAvailable = false } = {}): Promise<Room[]> {
  const where = onlyAvailable ? 'WHERE is_available = 1' : '';
  const { results } = await db.prepare(`SELECT * FROM rooms ${where} ORDER BY sort_order, name`).all<RoomRow>();
  return results.map(mapRoom);
}

export async function getRoom(db: D1Database, id: string): Promise<Room | null> {
  const row = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<RoomRow>();
  return row ? mapRoom(row) : null;
}

function roomValues(input: RoomInput) {
  return [
    input.slug,
    input.name,
    input.tagline,
    input.summary,
    input.description,
    input.roomType,
    input.floor,
    input.capacityMin,
    input.capacityMax,
    input.areaM2,
    JSON.stringify(input.layouts),
    JSON.stringify(input.amenities),
    JSON.stringify(input.photos),
    input.priceHour,
    input.priceShift,
    input.priceDay,
    input.showPrices ? 1 : 0,
    input.isAvailable ? 1 : 0,
    input.isFeatured ? 1 : 0,
    input.seoTitle,
    input.seoDescription,
  ];
}

async function assertSlugFree(db: D1Database, slug: string, exceptId?: string) {
  const row = await db
    .prepare('SELECT id FROM rooms WHERE slug = ? AND id != ?')
    .bind(slug, exceptId ?? '')
    .first<{ id: string }>();
  if (row) throw new HttpError(409, 'Já existe uma sala com esse endereço (slug).', { slug: 'Escolha outro slug.' });
}

export async function createRoom(db: D1Database, input: RoomInput, id = newId('sala-')): Promise<Room> {
  await assertSlugFree(db, input.slug);
  const ts = now();
  const max = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM rooms').first<{ m: number }>();
  await db
    .prepare(
      `INSERT INTO rooms (slug, name, tagline, summary, description, room_type, floor, capacity_min, capacity_max, area_m2,
        layouts, amenities, photos, price_hour, price_shift, price_day, show_prices, is_available, is_featured,
        seo_title, seo_description, id, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(...roomValues(input), id, input.sortOrder ?? (max?.m ?? 0) + 1, ts, ts)
    .run();
  return (await getRoom(db, id))!;
}

export async function updateRoom(db: D1Database, id: string, input: RoomInput): Promise<Room> {
  const current = await getRoom(db, id);
  if (!current) throw new HttpError(404, 'Sala não encontrada.');
  if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
    throw new HttpError(409, 'Esta sala foi alterada por outra pessoa enquanto você editava. Recarregue para ver a versão atual.');
  }
  await assertSlugFree(db, input.slug, id);
  await db
    .prepare(
      `UPDATE rooms SET slug=?, name=?, tagline=?, summary=?, description=?, room_type=?, floor=?, capacity_min=?, capacity_max=?,
        area_m2=?, layouts=?, amenities=?, photos=?, price_hour=?, price_shift=?, price_day=?, show_prices=?, is_available=?,
        is_featured=?, seo_title=?, seo_description=?, updated_at=? WHERE id=?`,
    )
    .bind(...roomValues(input), now(), id)
    .run();
  return (await getRoom(db, id))!;
}

export async function setRoomAvailability(db: D1Database, id: string, isAvailable: boolean): Promise<Room> {
  const res = await db
    .prepare('UPDATE rooms SET is_available = ?, updated_at = ? WHERE id = ?')
    .bind(isAvailable ? 1 : 0, now(), id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Sala não encontrada.');
  return (await getRoom(db, id))!;
}

export async function deleteRoom(db: D1Database, id: string): Promise<Room> {
  const room = await getRoom(db, id);
  if (!room) throw new HttpError(404, 'Sala não encontrada.');
  await db.prepare('DELETE FROM rooms WHERE id = ?').bind(id).run();
  return room;
}

export async function reorder(db: D1Database, table: 'rooms' | 'faqs', ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.batch(ids.map((id, i) => db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`).bind(i + 1, id)));
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

export async function getSettings(db: D1Database): Promise<SiteSettings> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'site'").first<{ value: string }>();
  return withDefaults(DEFAULT_SETTINGS, parseJson(row?.value, {}));
}

export async function saveSettings(db: D1Database, settings: SiteSettings): Promise<SiteSettings> {
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('site', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(JSON.stringify(settings), now())
    .run();
  return getSettings(db);
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

function mapFaq(r: Record<string, unknown>): Faq {
  return {
    id: String(r.id),
    question: String(r.question),
    answer: String(r.answer),
    scope: r.scope === 'corporativo' ? 'corporativo' : 'home',
    sortOrder: Number(r.sort_order ?? 0),
    isPublished: Boolean(r.is_published),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listFaqs(db: D1Database, { onlyPublished = false } = {}): Promise<Faq[]> {
  const where = onlyPublished ? 'WHERE is_published = 1' : '';
  const { results } = await db.prepare(`SELECT * FROM faqs ${where} ORDER BY scope, sort_order`).all();
  return results.map(mapFaq);
}

export async function createFaq(db: D1Database, input: FaqInput): Promise<Faq> {
  const id = newId('faq-');
  const ts = now();
  const max = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM faqs WHERE scope = ?').bind(input.scope).first<{ m: number }>();
  await db
    .prepare('INSERT INTO faqs (id, question, answer, scope, sort_order, is_published, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, input.question, input.answer, input.scope, (max?.m ?? 0) + 1, input.isPublished ? 1 : 0, ts, ts)
    .run();
  const row = await db.prepare('SELECT * FROM faqs WHERE id = ?').bind(id).first();
  return mapFaq(row!);
}

export async function updateFaq(db: D1Database, id: string, input: FaqInput): Promise<Faq> {
  const res = await db
    .prepare('UPDATE faqs SET question=?, answer=?, scope=?, is_published=?, updated_at=? WHERE id=?')
    .bind(input.question, input.answer, input.scope, input.isPublished ? 1 : 0, now(), id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Pergunta não encontrada.');
  const row = await db.prepare('SELECT * FROM faqs WHERE id = ?').bind(id).first();
  return mapFaq(row!);
}

export async function deleteFaq(db: D1Database, id: string): Promise<void> {
  const res = await db.prepare('DELETE FROM faqs WHERE id = ?').bind(id).run();
  if (!res.meta.changes) throw new HttpError(404, 'Pergunta não encontrada.');
}

// ---------------------------------------------------------------------------
// Consultas (leads)
// ---------------------------------------------------------------------------

function mapLead(r: Record<string, unknown>): Lead {
  return {
    id: String(r.id),
    name: String(r.name),
    email: String(r.email ?? ''),
    phone: String(r.phone ?? ''),
    space: String(r.space ?? ''),
    activity: String(r.activity ?? ''),
    eventDate: String(r.event_date ?? ''),
    people: r.people == null ? null : Number(r.people),
    modality: String(r.modality ?? ''),
    schedule: String(r.schedule ?? ''),
    details: String(r.details ?? ''),
    channel: String(r.channel ?? 'formulario') as LeadChannel,
    status: String(r.status ?? 'novo') as LeadStatus,
    notes: String(r.notes ?? ''),
    utm: parseJson(r.utm, {}),
    page: String(r.page ?? ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export type NewLead = Omit<Lead, 'id' | 'status' | 'notes' | 'createdAt' | 'updatedAt'> & { ipHash: string; userAgent: string };

export async function createLead(db: D1Database, lead: NewLead): Promise<Lead> {
  const id = newId('lead-');
  const ts = now();
  await db
    .prepare(
      `INSERT INTO leads (id, name, email, phone, space, activity, event_date, people, modality, schedule, details, channel, utm, page,
        ip_hash, user_agent, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      lead.name,
      lead.email,
      lead.phone,
      lead.space,
      lead.activity,
      lead.eventDate,
      lead.people,
      lead.modality,
      lead.schedule,
      lead.details,
      lead.channel,
      JSON.stringify(lead.utm),
      lead.page,
      lead.ipHash,
      lead.userAgent.slice(0, 300),
      ts,
      ts,
    )
    .run();
  return mapLead((await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first())!);
}

export async function listLeads(
  db: D1Database,
  { status, q, page = 1, pageSize = 25 }: { status?: string; q?: string; page?: number; pageSize?: number },
): Promise<Paginated<Lead>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR space LIKE ? OR details LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM leads ${clause}`).bind(...params).first<{ n: number }>();
  const { results } = await db
    .prepare(`SELECT * FROM leads ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all();
  return { items: results.map(mapLead), total: total?.n ?? 0, page, pageSize };
}

export async function getLead(db: D1Database, id: string): Promise<Lead | null> {
  const row = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  return row ? mapLead(row) : null;
}

export async function allLeads(db: D1Database): Promise<Lead[]> {
  const { results } = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 5000').all();
  return results.map(mapLead);
}

export async function updateLead(db: D1Database, id: string, patch: { status?: LeadStatus; notes?: string }): Promise<Lead> {
  const current = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  if (!current) throw new HttpError(404, 'Consulta não encontrada.');
  const lead = mapLead(current);
  await db
    .prepare('UPDATE leads SET status = ?, notes = ?, updated_at = ? WHERE id = ?')
    .bind(patch.status ?? lead.status, patch.notes ?? lead.notes, now(), id)
    .run();
  return mapLead((await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first())!);
}

export async function deleteLead(db: D1Database, id: string): Promise<void> {
  const res = await db.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
  if (!res.meta.changes) throw new HttpError(404, 'Consulta não encontrada.');
}

export async function leadStats(db: D1Database) {
  const d7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'novo' THEN 1 ELSE 0 END) AS new,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last7d,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last30d
       FROM leads`,
    )
    .bind(d7, d30)
    .first<{ total: number; new: number | null; last7d: number | null; last30d: number | null }>();
  return { total: row?.total ?? 0, new: row?.new ?? 0, last7d: row?.last7d ?? 0, last30d: row?.last30d ?? 0 };
}

export async function recentLeads(db: D1Database, limit = 5): Promise<Lead[]> {
  const { results } = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return results.map(mapLead);
}

// ---------------------------------------------------------------------------
// Usuários e sessões
// ---------------------------------------------------------------------------

export interface UserRecord extends AdminUser {
  passwordHash: string;
}

function mapUser(r: Record<string, unknown>): UserRecord {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name ?? ''),
    role: r.role === 'admin' ? 'admin' : 'editor',
    isActive: Boolean(r.is_active),
    createdAt: String(r.created_at),
    lastLoginAt: r.last_login_at ? String(r.last_login_at) : null,
    passwordHash: String(r.password_hash),
  };
}

export function publicUser(u: UserRecord): AdminUser {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  return row?.n ?? 0;
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRecord | null> {
  const row = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  return row ? mapUser(row) : null;
}

export async function findUserById(db: D1Database, id: string): Promise<UserRecord | null> {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return row ? mapUser(row) : null;
}

export async function listUsers(db: D1Database): Promise<AdminUser[]> {
  const { results } = await db.prepare('SELECT * FROM users ORDER BY created_at').all();
  return results.map((r) => publicUser(mapUser(r)));
}

export async function createUser(
  db: D1Database,
  data: { email: string; name: string; passwordHash: string; role: UserRole },
): Promise<AdminUser> {
  if (await findUserByEmail(db, data.email)) throw new HttpError(409, 'Já existe um usuário com esse e-mail.', { email: 'E-mail já cadastrado.' });
  const id = newId('user-');
  const ts = now();
  await db
    .prepare('INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)')
    .bind(id, data.email.toLowerCase(), data.name, data.passwordHash, data.role, ts, ts)
    .run();
  return publicUser((await findUserById(db, id))!);
}

export async function updateUser(
  db: D1Database,
  id: string,
  patch: { role?: UserRole; isActive?: boolean; name?: string; passwordHash?: string },
): Promise<AdminUser> {
  const u = await findUserById(db, id);
  if (!u) throw new HttpError(404, 'Usuário não encontrado.');
  await db
    .prepare('UPDATE users SET role = ?, is_active = ?, name = ?, password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(patch.role ?? u.role, (patch.isActive ?? u.isActive) ? 1 : 0, patch.name ?? u.name, patch.passwordHash ?? u.passwordHash, now(), id)
    .run();
  if (patch.isActive === false || patch.passwordHash) {
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  }
  return publicUser((await findUserById(db, id))!);
}

export async function countActiveAdmins(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function touchLogin(db: D1Database, id: string): Promise<void> {
  await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now(), id).run();
}

export async function createSession(db: D1Database, data: { id: string; userId: string; expiresAt: number; ip: string; userAgent: string }) {
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at, ip, user_agent) VALUES (?,?,?,?,?,?)')
    .bind(data.id, data.userId, data.expiresAt, now(), data.ip, data.userAgent.slice(0, 300))
    .run();
  // limpeza oportunista
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()).run();
}

export async function getSessionUser(db: D1Database, sessionId: string): Promise<UserRecord | null> {
  const row = await db
    .prepare('SELECT u.*, s.expires_at AS s_expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?')
    .bind(sessionId)
    .first<Record<string, unknown>>();
  if (!row || Number(row.s_expires) < Date.now() || !row.is_active) return null;
  return mapUser(row);
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

// ---------------------------------------------------------------------------
// Limite de tentativas (janela fixa) — login e formulário público
// ---------------------------------------------------------------------------

export async function hitRateLimit(
  db: D1Database,
  key: string,
  { limit, windowMs, lockMs = 0 }: { limit: number; windowMs: number; lockMs?: number },
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const t = Date.now();
  const row = await db.prepare('SELECT count, window_start, locked_until FROM rate_limits WHERE key = ?').bind(key).first<{
    count: number;
    window_start: number;
    locked_until: number | null;
  }>();
  if (row?.locked_until && row.locked_until > t) return { allowed: false, retryAfterSec: Math.ceil((row.locked_until - t) / 1000) };
  if (!row || t - row.window_start > windowMs) {
    await db
      .prepare('INSERT INTO rate_limits (key, count, window_start, locked_until) VALUES (?, 1, ?, NULL) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start, locked_until = NULL')
      .bind(key, t)
      .run();
    return { allowed: true, retryAfterSec: 0 };
  }
  const count = row.count + 1;
  const lockedUntil = count > limit && lockMs ? t + lockMs : null;
  await db.prepare('UPDATE rate_limits SET count = ?, locked_until = ? WHERE key = ?').bind(count, lockedUntil, key).run();
  if (count > limit) {
    const retry = lockedUntil ? lockedUntil - t : windowMs - (t - row.window_start);
    return { allowed: false, retryAfterSec: Math.ceil(retry / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export async function clearRateLimit(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export async function audit(
  db: D1Database,
  entry: { userId?: string | null; userEmail?: string | null; action: string; target?: string; meta?: Record<string, unknown>; ip?: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO audit_log (id, user_id, user_email, action, target, meta, ip, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(newId('log-'), entry.userId ?? null, entry.userEmail ?? null, entry.action, entry.target ?? '', JSON.stringify(entry.meta ?? {}), entry.ip ?? '', now())
    .run();
}

export async function listAudit(db: D1Database, page = 1, pageSize = 50): Promise<Paginated<AuditEntry>> {
  const total = await db.prepare('SELECT COUNT(*) AS n FROM audit_log').first<{ n: number }>();
  const { results } = await db
    .prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(pageSize, (page - 1) * pageSize)
    .all();
  return {
    items: results.map((r) => ({
      id: String(r.id),
      userEmail: r.user_email ? String(r.user_email) : null,
      action: String(r.action),
      target: String(r.target ?? ''),
      meta: parseJson(r.meta, {}),
      ip: String(r.ip ?? ''),
      createdAt: String(r.created_at),
    })),
    total: total?.n ?? 0,
    page,
    pageSize,
  };
}

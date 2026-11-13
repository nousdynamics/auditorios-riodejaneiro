import schemaSql from '../../../migrations/0001_schema.sql';
import { INITIAL_ADMINS } from './initial-admin';
import { createUser, findUserByEmail } from './repo';
import { DEFAULT_SETTINGS, SEED_FAQS, SEED_ROOMS } from './seed';

/**
 * Aumente quando adicionar um arquivo em migrations/ (inclua-o em MIGRATIONS) ou um item em
 * CONTENT_PATCHES. Bancos já criados rodam de novo o schema (idempotente) e os patches.
 */
export const SCHEMA_VERSION = '6';
const MIGRATIONS = [schemaSql];

/**
 * Correções de texto do conteúdo inicial em bancos que já existem. Cada patch só troca o
 * texto se ele ainda estiver igual ao original, para não sobrescrever edições do painel.
 */
const CONTENT_PATCHES: { table: 'faqs'; id: string; column: 'answer'; from: string; to: string }[] = [
  {
    // v2: o formulário passou a enviar a consulta direto (sem mensagem para revisar)
    table: 'faqs',
    id: 'faq-confirmar-reserva',
    column: 'answer',
    from: 'A mensagem preparada no site é uma consulta inicial. A reserva só é confirmada depois que a equipe verifica a data, o horário e as condições de locação e responde a você.',
    to: 'Envie a consulta pelo formulário do site. A equipe verifica a data, o horário e as condições de locação e responde no WhatsApp ou no e-mail. A reserva fica confirmada quando vocês combinam os detalhes e agendam a sala.',
  },
];

/**
 * v3: a marca do site passou a ser "Auditório Rio de Janeiro". Troca só os campos das
 * configurações que ainda têm o texto inicial (edições feitas no painel ficam como estão)
 * e tira "da InterFISIO" do texto alternativo das fotos iniciais.
 */
const REBRAND_V3: { path: string[]; from: string; to: string }[] = [
  { path: ['brandName'], from: 'InterFISIO', to: DEFAULT_SETTINGS.brandName },
  // v6: número do WhatsApp igual ao dos anúncios
  { path: ['whatsapp'], from: '5521967770445', to: DEFAULT_SETTINGS.whatsapp },
  { path: ['brandLine'], from: 'Locação de auditórios no Rio de Janeiro', to: DEFAULT_SETTINGS.brandLine },
  { path: ['whatsappMessage'], from: 'Olá! Gostaria de consultar a locação de um auditório da InterFISIO.', to: DEFAULT_SETTINGS.whatsappMessage },
  {
    path: ['hero', 'intro'],
    from: 'Realize sua próxima aula, curso ou reunião na InterFISIO. Escolha um auditório por hora ou turno, ou consulte o pacote corporativo para locar o andar completo.',
    to: DEFAULT_SETTINGS.hero.intro,
  },
];

async function rebrandV3(db: D1Database, now: string): Promise<void> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'site'").first<{ value: string }>();
  if (row) {
    const site = JSON.parse(row.value) as Record<string, unknown>;
    let changed = false;
    for (const { path, from, to } of REBRAND_V3) {
      const parent = path.slice(0, -1).reduce<Record<string, unknown> | undefined>((o, k) => o?.[k] as Record<string, unknown> | undefined, site);
      const key = path[path.length - 1];
      if (parent && parent[key] === from) {
        parent[key] = to;
        changed = true;
      }
    }
    if (changed) {
      await db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'site'").bind(JSON.stringify(site), now).run();
    }
  }
  await db
    .prepare("UPDATE rooms SET photos = REPLACE(photos, ' da InterFISIO', ''), updated_at = ? WHERE photos LIKE '%da InterFISIO%'")
    .bind(now)
    .run();
}

let ready: Promise<void> | null = null;

/**
 * Garante schema + conteúdo inicial. Roda uma vez por isolate; nas próximas requisições
 * é só uma promise resolvida. Seguro para rodar em paralelo (tudo é idempotente).
 */
export function ensureDatabase(db: D1Database): Promise<void> {
  ready ??= bootstrap(db).catch((err) => {
    ready = null; // tenta de novo na próxima requisição
    throw err;
  });
  return ready;
}

export function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function readMeta(db: D1Database, key: string): Promise<string | null> {
  try {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
    return row?.value ?? null;
  } catch {
    return null; // tabela ainda não existe
  }
}

async function bootstrap(db: D1Database): Promise<void> {
  const version = await readMeta(db, 'schema_version');
  if (version === SCHEMA_VERSION) return;

  for (const sql of MIGRATIONS) {
    await db.batch(splitSql(sql).map((s) => db.prepare(s)));
  }

  const now = new Date().toISOString();
  if (!(await readMeta(db, 'seeded_at'))) {
    const stmts: D1PreparedStatement[] = [];
    for (const r of SEED_ROOMS) {
      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO rooms (id, slug, name, tagline, summary, description, room_type, floor, capacity_min, capacity_max, area_m2,
              layouts, amenities, photos, price_hour, price_shift, price_day, show_prices, is_available, is_featured, sort_order,
              seo_title, seo_description, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            r.id,
            r.slug,
            r.name,
            r.tagline,
            r.summary,
            r.description,
            r.roomType,
            r.floor,
            r.capacityMin,
            r.capacityMax,
            r.areaM2,
            JSON.stringify(r.layouts),
            JSON.stringify(r.amenities),
            JSON.stringify(r.photos),
            r.priceHour,
            r.priceShift,
            r.priceDay,
            r.showPrices ? 1 : 0,
            r.isAvailable ? 1 : 0,
            r.isFeatured ? 1 : 0,
            r.sortOrder,
            r.seoTitle,
            r.seoDescription,
            now,
            now,
          ),
      );
    }
    for (const f of SEED_FAQS) {
      stmts.push(
        db
          .prepare(
            'INSERT OR IGNORE INTO faqs (id, question, answer, scope, sort_order, is_published, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)',
          )
          .bind(f.id, f.question, f.answer, f.scope, f.sortOrder, now, now),
      );
    }
    stmts.push(
      db
        .prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?,?,?)')
        .bind('site', JSON.stringify(DEFAULT_SETTINGS), now),
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,?)').bind('seeded_at', now, now),
    );
    await db.batch(stmts);
  }

  if (CONTENT_PATCHES.length) {
    await db.batch(
      CONTENT_PATCHES.map((p) =>
        db.prepare(`UPDATE ${p.table} SET ${p.column} = ?, updated_at = ? WHERE id = ? AND ${p.column} = ?`).bind(p.to, now, p.id, p.from),
      ),
    );
  }

  await rebrandV3(db, now);

  // v4/v5: administradores iniciais com senha temporária, cada um criado uma única vez
  for (const admin of INITIAL_ADMINS) {
    const key = `initial_admin:${admin.email}`;
    if (await readMeta(db, key)) continue;
    if (!(await findUserByEmail(db, admin.email))) {
      await createUser(db, { email: admin.email, name: admin.name, passwordHash: admin.passwordHash, role: 'admin' });
    }
    await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,?)').bind(key, now, now).run();
  }

  await db
    .prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,?)')
    .bind('schema_version', SCHEMA_VERSION, now)
    .run();
}

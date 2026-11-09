import schemaSql from '../../../migrations/0001_schema.sql';
import { DEFAULT_SETTINGS, SEED_FAQS, SEED_ROOMS } from './seed';

/**
 * Aumente quando adicionar um arquivo em migrations/ (inclua-o em MIGRATIONS) ou um item em
 * CONTENT_PATCHES. Bancos já criados rodam de novo o schema (idempotente) e os patches.
 */
export const SCHEMA_VERSION = '2';
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

  await db
    .prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,?)')
    .bind('schema_version', SCHEMA_VERSION, now)
    .run();
}

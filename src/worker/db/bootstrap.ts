import schemaSql from '../../../migrations/0001_schema.sql';
import { DEFAULT_SETTINGS, SEED_FAQS, SEED_ROOMS } from './seed';

/** Aumente quando adicionar um novo arquivo em migrations/ e inclua-o em MIGRATIONS. */
export const SCHEMA_VERSION = '1';
const MIGRATIONS = [schemaSql];

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

  await db
    .prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,?)')
    .bind('schema_version', SCHEMA_VERSION, now)
    .run();
}

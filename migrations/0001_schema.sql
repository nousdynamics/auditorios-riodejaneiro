-- Schema do site e do portal. Idempotente: o Worker também aplica este arquivo
-- na primeira requisição (src/worker/db/bootstrap.ts), então não é obrigatório
-- rodar `wrangler d1 migrations apply` — mas funciona igual se rodar.

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  room_type TEXT NOT NULL DEFAULT 'Auditório',
  floor TEXT NOT NULL DEFAULT '',
  capacity_min INTEGER,
  capacity_max INTEGER NOT NULL DEFAULT 0,
  area_m2 REAL,
  layouts TEXT NOT NULL DEFAULT '{}',
  amenities TEXT NOT NULL DEFAULT '[]',
  photos TEXT NOT NULL DEFAULT '[]',
  price_hour REAL,
  price_shift REAL,
  price_day REAL,
  show_prices INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rooms_sort_idx ON rooms (sort_order);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'home',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS faqs_scope_idx ON faqs (scope, sort_order);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  space TEXT NOT NULL DEFAULT '',
  activity TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  people INTEGER,
  modality TEXT NOT NULL DEFAULT '',
  schedule TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'formulario',
  status TEXT NOT NULL DEFAULT 'novo',
  notes TEXT NOT NULL DEFAULT '',
  utm TEXT NOT NULL DEFAULT '{}',
  page TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads (created_at);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

-- id = SHA-256 do token do cookie (o token em si nunca é gravado)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Janela fixa de contagem para login e formulário público
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  locked_until INTEGER
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log (created_at);

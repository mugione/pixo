-- Phase 2/3: accounts (passkeys), workspace data, AI usage tracking and system settings.
-- Timestamps are ISO-8601 UTC strings. IDs are UUID v4 strings.

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  brand_name      TEXT,
  email           TEXT,                       -- optional contact address, never auto-verified
  email_verified  INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  purpose         TEXT,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  language        TEXT NOT NULL DEFAULT 'tr' CHECK (language IN ('tr', 'en')),
  text_limit_override  INTEGER,               -- per-user daily quota overrides (NULL = system default)
  image_limit_override INTEGER,
  onboarded       INTEGER NOT NULL DEFAULT 0 CHECK (onboarded IN (0, 1)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS passkeys (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id   TEXT NOT NULL UNIQUE,       -- base64url
  public_key      TEXT NOT NULL,              -- base64url (COSE)
  counter         INTEGER NOT NULL DEFAULT 0,
  transports      TEXT,                       -- JSON array
  name            TEXT,
  created_at      TEXT NOT NULL,
  last_used_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys (user_id);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL UNIQUE,
  used_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes (user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  revoked_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- Short-lived WebAuthn challenges (no KV needed).
CREATE TABLE IF NOT EXISTS auth_challenges (
  id          TEXT PRIMARY KEY,
  challenge   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('register', 'login', 'add_passkey')),
  user_id     TEXT,
  payload     TEXT,                           -- JSON (pending registration fields)
  rp_id       TEXT NOT NULL,
  origin      TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON auth_challenges (expires_at);

-- Generic fixed-window rate limiter (keys are hashed, never raw IPs).
CREATE TABLE IF NOT EXISTS rate_limits (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL,
  reset_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  industry         TEXT,
  target_audience  TEXT,
  primary_color    TEXT,
  secondary_color  TEXT,
  slogan           TEXT,
  tone             TEXT,
  language         TEXT NOT NULL DEFAULT 'tr' CHECK (language IN ('tr', 'en')),
  preferred_phrases TEXT,
  avoided_phrases  TEXT,
  is_default       INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brands_user ON brands (user_id);

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id         TEXT REFERENCES brands(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT,
  target_audience  TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_user ON products (user_id);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id      TEXT REFERENCES brands(id) ON DELETE SET NULL,
  product_id    TEXT REFERENCES products(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('text', 'campaign', 'image')),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  content_json  TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects (user_id, updated_at DESC);

-- Images are NEVER stored here (no base64): only prompts/text and metadata.
CREATE TABLE IF NOT EXISTS generations (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id       TEXT REFERENCES projects(id) ON DELETE SET NULL,
  provider         TEXT NOT NULL,
  model            TEXT NOT NULL,
  generation_type  TEXT NOT NULL CHECK (generation_type IN ('text', 'campaign', 'image')),
  request_status   TEXT NOT NULL CHECK (request_status IN ('pending', 'succeeded', 'failed')),
  idempotency_key  TEXT NOT NULL,
  output_text      TEXT,
  error_code       TEXT,
  estimated_usage  INTEGER NOT NULL DEFAULT 0,
  usage_date_utc   TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_generations_user_created ON generations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_created ON generations (created_at DESC);

CREATE TABLE IF NOT EXISTS usage_daily (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date_utc     TEXT NOT NULL,
  text_requests      INTEGER NOT NULL DEFAULT 0,
  image_requests     INTEGER NOT NULL DEFAULT 0,
  estimated_neurons  INTEGER NOT NULL DEFAULT 0,
  last_used_at       TEXT,
  updated_at         TEXT NOT NULL,
  UNIQUE (user_id, usage_date_utc)
);

CREATE TABLE IF NOT EXISTS global_usage_daily (
  usage_date_utc     TEXT PRIMARY KEY,
  total_requests     INTEGER NOT NULL DEFAULT 0,
  estimated_neurons  INTEGER NOT NULL DEFAULT 0,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  category    TEXT,
  message     TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id             TEXT PRIMARY KEY,
  actor_user_id  TEXT,
  event_type     TEXT NOT NULL,
  resource_type  TEXT,
  resource_id    TEXT,
  metadata       TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- Defaults (product policy, adjustable without redeploy via wrangler d1 execute / admin panel).
-- Neuron figures are conservative server-side ESTIMATES, not Cloudflare's billing metric.
INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES
  ('ai_enabled',                 'true',  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('registrations_enabled',      'true',  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('maintenance_mode',           'false', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('user_daily_text_limit',      '3',     strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('user_daily_image_limit',     '1',     strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('global_daily_neuron_budget', '6000',  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('text_neurons_estimate',      '120',   strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('image_neurons_estimate',     '400',   strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('text_model',                 '@cf/zai-org/glm-4.7-flash', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('image_model',                '@cf/black-forest-labs/flux-2-klein-4b', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('max_upload_mb',              '5',     strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('announcement',               '',      strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

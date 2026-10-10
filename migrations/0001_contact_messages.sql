-- Phase 1: contact form submissions (shown in the admin panel in Phase 5).
-- Never edit an applied migration; add a new numbered file instead.
CREATE TABLE IF NOT EXISTS contact_messages (
  id          TEXT PRIMARY KEY,                       -- UUID v4
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  email       TEXT NOT NULL CHECK (length(email) BETWEEN 5 AND 254),
  subject     TEXT NOT NULL CHECK (length(subject) BETWEEN 2 AND 150),
  message     TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 5000),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  lang        TEXT NOT NULL DEFAULT 'tr' CHECK (lang IN ('tr', 'en')),
  ip_hash     TEXT,                                   -- salted SHA-256, only for rate limiting
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created ON contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_ip_created ON contact_messages (ip_hash, created_at);

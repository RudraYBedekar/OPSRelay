-- SecureData database schema — credentials isolated from operational data (Rudra)
-- Run only against CRDB_SECURE_DATABASE (default: SecureData)

CREATE TABLE IF NOT EXISTS users (
  id            STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  member_id     STRING UNIQUE NOT NULL,
  user_id       STRING UNIQUE NOT NULL,
  email         STRING UNIQUE NOT NULL,
  password_hash STRING NOT NULL,
  name          STRING NOT NULL,
  role          STRING NOT NULL DEFAULT 'operator',
  email_verified BOOL NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_secure_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_secure_users_user_id ON users (user_id);
CREATE INDEX IF NOT EXISTS idx_secure_users_member_id ON users (member_id);

-- Audit trail — no passwords, no raw emails in log rows
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id         STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  event_type STRING NOT NULL,
  user_ref   STRING,
  ip_hash    STRING,
  meta       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON auth_audit_log (created_at DESC);

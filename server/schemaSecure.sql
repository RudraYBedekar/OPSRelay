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

-- Incident access sharing between members
CREATE TABLE IF NOT EXISTS access_requests (
  id                  STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  requester_member_id STRING NOT NULL,
  requester_name      STRING NOT NULL,
  owner_member_id     STRING NOT NULL,
  status              STRING NOT NULL DEFAULT 'pending',
  message             STRING,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS member_access_grants (
  id                  STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  owner_member_id     STRING NOT NULL,
  viewer_member_id    STRING NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_member_id, viewer_member_id)
);

CREATE INDEX IF NOT EXISTS idx_access_requests_owner ON access_requests (owner_member_id, status);
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON access_requests (requester_member_id, status);

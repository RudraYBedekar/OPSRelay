-- Bootstrap migration ledger (must run before any other versioned migration)

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     STRING PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Autonomous Incident Commander — relational memory for agent decisions, SLA, war rooms

CREATE TABLE IF NOT EXISTS commander_sessions (
  id                        STRING PRIMARY KEY,
  incident_id               STRING NOT NULL UNIQUE,
  status                    STRING NOT NULL DEFAULT 'ACTIVE',
  sla_deadline              TIMESTAMPTZ NOT NULL,
  response_deadline         TIMESTAMPTZ NOT NULL,
  sla_breached              BOOL NOT NULL DEFAULT false,
  primary_expert_member_id  STRING,
  primary_expert_name       STRING,
  escalation_level          INT NOT NULL DEFAULT 0,
  handoff_summary           STRING,
  analysis                  JSONB NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commander_decisions (
  id            STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  session_id    STRING NOT NULL,
  incident_id   STRING NOT NULL,
  decision_type STRING NOT NULL,
  title         STRING NOT NULL,
  description   STRING NOT NULL,
  confidence    FLOAT NOT NULL,
  reasoning     JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commander_assignments (
  id           STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  session_id   STRING NOT NULL,
  incident_id  STRING NOT NULL,
  member_id    STRING NOT NULL,
  expert_name  STRING NOT NULL,
  rank         INT NOT NULL,
  score        FLOAT NOT NULL,
  factors      JSONB NOT NULL DEFAULT '{}',
  status       STRING NOT NULL DEFAULT 'PENDING',
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commander_actions (
  id           STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  session_id   STRING NOT NULL,
  incident_id  STRING NOT NULL,
  action_type  STRING NOT NULL,
  title        STRING NOT NULL,
  description  STRING,
  actor        STRING NOT NULL,
  outcome      STRING NOT NULL DEFAULT 'pending',
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commander_replay_events (
  id           STRING PRIMARY KEY DEFAULT gen_random_uuid()::STRING,
  session_id   STRING NOT NULL,
  incident_id  STRING NOT NULL,
  event_type   STRING NOT NULL,
  title        STRING NOT NULL,
  description  STRING,
  actor        STRING NOT NULL,
  confidence   FLOAT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commander_sessions_incident ON commander_sessions (incident_id);
CREATE INDEX IF NOT EXISTS idx_commander_sessions_status ON commander_sessions (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_commander_decisions_session ON commander_decisions (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commander_assignments_session ON commander_assignments (session_id, rank);
CREATE INDEX IF NOT EXISTS idx_commander_actions_incident ON commander_actions (incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commander_replay_incident ON commander_replay_events (incident_id, created_at);

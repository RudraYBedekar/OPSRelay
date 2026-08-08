# OpsRelay — System Architecture

This document describes how **CockroachDB**, **AWS services**, and the **OpsRelay agent** interact in production. It reflects the deployed stack at `http://18.232.197.149/` (EC2 + Nginx + PM2).

---

## 1. Executive summary

OpsRelay is a full-stack incident-response platform:

| Layer | Technology | Role |
|-------|------------|------|
| **Client** | React + Vite | Dashboard, intake, Ask AI, task board |
| **API** | Express (Node.js) | Auth, REST, agent orchestration, job worker |
| **Primary data** | CockroachDB Cloud (`Rudra`) | Incidents, vectors, chat, metrics, jobs |
| **Credentials** | CockroachDB Cloud (`SecureData`) | Users, passwords (bcrypt), JWT identity |
| **Evidence store** | CockroachDB (`opsrelay_evidence`) | Human-approved summaries for MCP queries |
| **AI** | AWS Bedrock (us-east-1) | Extraction, reasoning, embeddings |
| **Investigator** | CockroachDB Cloud Managed MCP | Read-only `select_query` over evidence |

The agent is **not a separate microservice**. It runs inside the Express API as `agentService` (vector memory) and `investigatorService` (MCP evidence), calling Bedrock and CockroachDB through shared services.

![OpsRelay system architecture — CockroachDB, AWS Bedrock, and agent interaction](./images/opsrelay-architecture.png)

---

## 2. High-level system context

```mermaid
flowchart TB
  subgraph Users["Users (Browser)"]
    UI["React SPA<br/>Dashboard · Intake · Ask AI"]
  end

  subgraph EC2["AWS EC2 (us-east-1)"]
    NGINX["Nginx<br/>static + /api proxy"]
    API["Express API (PM2)<br/>server/"]
    WORKER["Job Worker<br/>15s interval"]
  end

  subgraph CRDB["CockroachDB Cloud"]
    RUDRA[("Rudra DB<br/>incidents · embeddings<br/>tasks · chat · jobs")]
    SECURE[("SecureData DB<br/>users · auth")]
    EVIDENCE[("opsrelay_evidence<br/>incident_evidence")]
  end

  subgraph AWS["AWS Bedrock (us-east-1)"]
    HAIKU["Claude Haiku 4.5<br/>Intake extraction"]
    NOVA["Amazon Nova 2 Lite<br/>Agent reasoning"]
    TITAN["Titan Embed v2<br/>1024-dim vectors"]
  end

  subgraph MCP["CockroachDB Cloud Managed MCP"]
    MCPHTTP["Streamable HTTP<br/>select_query (read-only)"]
  end

  UI -->|HTTPS| NGINX
  NGINX -->|"/"| UI
  NGINX -->|"/api/*"| API
  API --> WORKER

  API -->|SQL + VECTOR| RUDRA
  API -->|SQL auth| SECURE
  API -->|project on approve| EVIDENCE
  API -->|InvokeModel| HAIKU
  API -->|InvokeModel| NOVA
  API -->|InvokeModel| TITAN

  API -->|MCP client| MCPHTTP
  MCPHTTP -->|read-only SELECT| EVIDENCE

  WORKER --> RUDRA
  WORKER --> TITAN
```

---

## 3. Deployment topology

```mermaid
flowchart LR
  subgraph Internet
    USER["On-call engineer"]
  end

  subgraph EC2_Instance["EC2 ubuntu@18.232.197.149"]
    direction TB
    NGINX["Nginx :80<br/>dist/ + proxy"]
    PM2["PM2 opsrelay-api<br/>npm run start:server :3001"]
    REPO["~/OPSRELAYDashboard<br/>git pull + deploy.sh"]
  end

  subgraph External
    GH["GitHub OPSRelay"]
    CRDB["CockroachDB Cloud"]
    BEDROCK["AWS Bedrock"]
    MCP["cockroachlabs.cloud/mcp"]
  end

  USER --> NGINX
  NGINX --> PM2
  REPO --> NGINX
  REPO --> PM2
  GH -->|git pull| REPO
  PM2 --> CRDB
  PM2 --> BEDROCK
  PM2 --> MCP
```

**Deploy path:** `git push` → EC2 `git pull` → `npm run build` → PM2 restart → Nginx serves `dist/`.

---

## 4. CockroachDB data architecture

OpsRelay uses **two logical databases** plus an **evidence projection**:

```mermaid
erDiagram
  RUDRA_INCIDENTS ||--o{ RUDRA_EMBEDDINGS : "indexed chunks"
  RUDRA_INCIDENTS ||--o{ RUDRA_TASKS : "action items"
  RUDRA_USERS ||--o{ RUDRA_INCIDENTS : "ownerMemberId"
  RUDRA_INCIDENTS ||--o{ EVIDENCE_ROWS : "on approve"

  RUDRA_INCIDENTS {
    string id PK
    jsonb data
    string owner_member_id
  }

  RUDRA_EMBEDDINGS {
    string incident_id FK
    vector embedding "1024 dims"
    string chunk_type
    string embed_provider
  }

  EVIDENCE_ROWS {
    string citation_id PK
    string incident_id
    string approved_summary
    string approved_resolution
    int evidence_version
  }

  SECURE_USERS {
    string user_id PK
    string password_hash
    string member_id
  }
```

| Database | Key tables | Access |
|----------|------------|--------|
| **Rudra** | `incidents`, `incident_embeddings`, `alert_embeddings`, `dashboard_metrics`, `memory_chats`, `analysis_runs`, `incident_jobs` | Express `pool` — read/write, auth-scoped |
| **SecureData** | `users` | Express `securePool` — auth only |
| **opsrelay_evidence** | `incident_evidence` | Written on analysis **approve**; read via MCP or local SQL demo |

**Vector search:** Titan embeddings stored in `incident_embeddings`. Queries use CockroachDB cosine distance with a 55% similarity threshold and auth-scoped incident IDs.

---

## 5. AWS Bedrock integration

All Bedrock calls go through `server/services/bedrockClient.ts` (`BedrockRuntimeClient` + `InvokeModelCommand`).

```mermaid
flowchart LR
  subgraph API["Express API"]
    EXTRACT["llmService.extractIncidentFromNotes"]
    AGENT["llmService.generateAgentResponse"]
    EMBED["embedService.embedText"]
    ALERT["alertFatigueService"]
  end

  subgraph Bedrock["AWS Bedrock us-east-1"]
    HAIKU["Claude Haiku 4.5<br/>BEDROCK_LLM_MODEL"]
    NOVA["Nova 2 Lite<br/>BEDROCK_AGENT_MODEL"]
    TITAN["Titan Embed Text v2<br/>BEDROCK_EMBED_MODEL"]
  end

  EXTRACT -->|structured JSON| HAIKU
  AGENT -->|markdown answer| NOVA
  EMBED -->|1024-dim vector| TITAN
  ALERT --> TITAN

  EXTRACT -.->|secrets redacted| EXTRACT
  EMBED -.->|secrets redacted| EMBED
```

| Model | Env var | Used for |
|-------|---------|----------|
| Claude Haiku 4.5 | `BEDROCK_LLM_MODEL` | Paste logs → structured incident JSON (intake / analysis pipeline) |
| Amazon Nova 2 Lite | `BEDROCK_AGENT_MODEL` | Ask AI answers, MCP investigator synthesis |
| Titan Embed v2 | `BEDROCK_EMBED_MODEL` | Index incidents & alerts; query embedding for vector search |

Credentials: standard AWS SDK chain on EC2 (instance profile or env keys). Toggle: `BEDROCK_ENABLED=true`.

---

## 6. Agent architecture (two modes)

The **Ask AI** console exposes two agent paths:

### 6a. Vector memory agent (`POST /api/agent/run`)

Primary path for “Have we seen this before?”

```mermaid
sequenceDiagram
  participant UI as React AgentConsole
  participant API as agentService
  participant CRDB as CockroachDB Rudra
  participant BR as AWS Bedrock

  UI->>API: POST /agent/run { query, incidentId? }
  API->>CRDB: Load auth-scoped incidents
  API->>CRDB: Corpus keyword match (ID, title, service)
  API->>BR: Titan embed(query) [if index exists]
  API->>CRDB: VECTOR search incident_embeddings
  API->>API: Merge + rank top 5 matches
  alt BEDROCK_ENABLED
    API->>BR: Nova generateAgentResponse(context)
    BR-->>API: Markdown answer
  else fallback
    API->>API: buildLocalAgentAnswer()
  end
  API->>CRDB: Save memory_chats (optional)
  API-->>UI: answer, similarIncidents, steps, suggestedTasks
```

**Key files:** `server/services/agentService.ts`, `server/services/vectorService.ts`, `server/services/llmService.ts`

### 6b. MCP investigator (`POST /api/investigator/query`)

Read-only evidence lookup with citation cards.

```mermaid
sequenceDiagram
  participant UI as React AgentConsole
  participant INV as investigatorService
  participant MCP as managedMcpClient
  participant MCPP as CockroachDB Cloud MCP
  participant EVD as opsrelay_evidence
  participant BR as AWS Bedrock Nova

  UI->>INV: POST /investigator/query { question, incidentId? }
  INV->>INV: inferIntent + buildInvestigationQuery
  alt MCP_MODE=managed_mcp
    INV->>MCP: executeViaManagedMcp(spec)
    MCP->>MCPP: callTool select_query (read-only)
    MCPP->>EVD: SELECT approved_summary, approved_resolution...
    EVD-->>MCPP: rows
    MCPP-->>MCP: parsed EvidenceRow[]
  else MCP_MODE=local_sql_demo
    INV->>EVD: Direct SQL SELECT (same schema)
  end
  INV->>INV: rowToCitations + groundAnswer
  opt BEDROCK_ENABLED
    INV->>BR: Nova synthesize from citations only
  end
  INV-->>UI: answer, citations[], readOnly: true
```

**Evidence pipeline:** When an operator **approves** AI extraction, `analysisService` calls `evidenceProjectionService.projectIncidentEvidence()` → rows in `incident_evidence` become MCP-queryable approved facts.

**Key files:** `server/services/investigatorService.ts`, `server/mcp/managedMcpClient.ts`, `server/mcp/investigationQueries.ts`

---

## 7. Incident intake & analysis pipeline

```mermaid
sequenceDiagram
  participant UI as IntakePanel
  participant API as analysisService
  participant CRDB as CockroachDB
  participant BR as Bedrock Haiku
  participant VS as vectorService
  participant EP as evidenceProjection

  UI->>API: POST /incidents/:id/analysis (raw notes)
  API->>CRDB: Persist incident + analysis_run (running)
  API->>BR: extractIncidentFromNotes (Haiku)
  BR-->>API: JSON draft (Zod validated)
  API->>CRDB: analysis_run → review_required
  UI->>API: POST approve (human review)
  API->>CRDB: Finalize incident JSON
  API->>VS: indexIncident → Titan embed → incident_embeddings
  API->>EP: projectIncidentEvidence → incident_evidence
  API->>CRDB: Enqueue post-approval jobs (worker)
```

Background **job worker** (`server/services/jobWorker.ts`, 15s poll) processes embedding and alert-fatigue jobs asynchronously.

---

## 8. Security & trust boundaries

```mermaid
flowchart TB
  subgraph Public
    BROWSER["Browser JWT in Authorization header"]
  end

  subgraph API_Trust["Express API (trust zone)"]
    AUTH["requireAuth middleware"]
    ACL["incidentAccessService<br/>owner · shared · viewer"]
    REDACT["redactSecrets before Bedrock/embed"]
    SANITIZE["sanitizeErrorForClient"]
  end

  subgraph Data
    RUDRA[("Rudra — scoped by memberId")]
    SECURE[("SecureData — credentials")]
    EVIDENCE[("Evidence — approved only")]
  end

  subgraph ReadOnly
    MCP["Managed MCP select_query<br/>tool policy + SQL allowlist"]
  end

  BROWSER --> AUTH --> ACL
  ACL --> RUDRA
  AUTH --> SECURE
  ACL --> EVIDENCE
  MCP --> EVIDENCE
  ACL -.->|never raw notes to MCP| MCP
  REDACT --> Bedrock["AWS Bedrock"]
```

| Control | Implementation |
|---------|----------------|
| Authentication | JWT (`requireAuth` on `/api/*` except `/api/auth`, health) |
| Authorization | Per-incident owner/shared/viewer; investigator role gate |
| MCP | Read-only; `select_query` only; SQL allowlist on `incident_evidence` |
| Secrets | Stripped before LLM/embed; production requires Bedrock (no local embed) |
| Vector search | Results filtered to incidents the user may view |

---

## 9. API surface (agent-relevant)

| Endpoint | Service | Backend dependencies |
|----------|---------|----------------------|
| `POST /api/agent/run` | Vector memory agent | Rudra, Titan, Nova |
| `GET /api/agent/status` | Health | embedding count, Bedrock flag |
| `POST /api/agent/index` | Re-index (admin) | Titan → incident_embeddings |
| `POST /api/investigator/query` | MCP investigator | MCP or local SQL, Nova |
| `GET /api/investigator/status` | MCP probe | mcpConfig, last request status |
| `POST /api/incidents/.../analysis` | Intake AI | Haiku, Rudra |
| `GET /api/health` | Platform health | CRDB, Bedrock, MCP, vectors |

---

## 10. Configuration reference

```env
# CockroachDB
DATABASE_URL=postgresql://...@....cockroachlabs.cloud:26257/Rudra
SECURE_DATABASE_URL=postgresql://...@....cockroachlabs.cloud:26257/SecureData

# Frontend
VITE_USE_CRDB=true
VITE_API_URL=/api

# AWS Bedrock
BEDROCK_ENABLED=true
AWS_REGION=us-east-1
BEDROCK_LLM_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_AGENT_MODEL=us.amazon.nova-2-lite-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
BEDROCK_EMBED_DIMENSIONS=1024

# MCP investigator
MCP_MODE=managed_mcp          # or local_sql_demo | disabled
MCP_CLUSTER_ID=...
MCP_ACCESS_TOKEN=...
MCP_EVIDENCE_DATABASE=opsrelay_evidence
```

---

## 11. Related docs

- [DEMO_FLOW.md](./DEMO_FLOW.md) — Live demo script (vector + MCP talking points)
- [BEDROCK_VECTOR_SETUP.md](./BEDROCK_VECTOR_SETUP.md) — Bedrock and embedding setup
- [COCKROACHDB_SETUP.md](./COCKROACHDB_SETUP.md) — Cluster and schema
- [EC2_DEPLOY.md](./EC2_DEPLOY.md) — Production deploy
- [WHAT_WE_BUILT.md](./WHAT_WE_BUILT.md) — Feature summary

---

*Last updated: August 2026 — matches commit on `main` (OpsRelay Dashboard).*

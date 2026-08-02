# OpsRelay Dashboard

OpsRelay is an **AI incident-response and shift-handoff dashboard** for operations teams. It helps engineers capture messy incident notes, turn them into structured data, search past incidents, and track open tasks — all in one dark-themed operations UI.

Built with **React**, **TypeScript**, **Tailwind CSS**, **CockroachDB**, and **AWS Bedrock**.

> **AI setup guide:** See [docs/BEDROCK_VECTOR_SETUP.md](docs/BEDROCK_VECTOR_SETUP.md) for full Bedrock + vector indexing setup from scratch.

---

## What This Website Does

Think of OpsRelay as a **smart notebook for on-call engineers**. When something breaks at 2 AM, you paste your Slack logs and handoff notes — the app helps organize everything so the next person knows exactly what happened.

### Main Features

| Section | What it does |
|---------|--------------|
| **Dashboard** | Shows incident metrics (open SEV-0/1 count, MTTR, open tasks) and a table of recent incidents |
| **Incident Intake** | Paste shift handoff notes into a large textarea → AI extracts severity, service, timeline, decisions, and tasks |
| **Memory Search** | Chat-style search — ask *"Have we seen this before?"* and get related past incidents with similarity scores |
| **Task Board** | Open action items grouped by incident; update task status inline |
| **Incident Detail** | Full view of one incident: timeline, decisions, fixes applied, tasks, and similar incidents |

### Design

- Modern dark operations dashboard
- CockroachDB-inspired red accents
- Responsive sidebar navigation
- Loading, empty, success, and error states
- Realistic sample incident data included

---

## How CockroachDB Works Here (Simple Explanation)

**CockroachDB is the database where all your incident data lives permanently.**

Without a database, the app would only store data in your browser (localStorage) — refresh on a different machine and it's gone. With CockroachDB, everything is saved in the cloud and shared across sessions.

### The flow in plain English

```
You use the website  →  API server reads/writes  →  CockroachDB stores the data
```

1. **You** click "Save Incident" or load the dashboard in the browser.
2. The **React frontend** sends a request to the **Express API** (`server/`).
3. The **API** runs SQL queries against **CockroachDB Cloud** using your `DATABASE_URL`.
4. **CockroachDB** saves or returns the data (incidents, tasks, metrics, chat history).
5. The **website** displays the result.

### What's stored in the database

| Table | Stores |
|-------|--------|
| `incidents` | Full incident records (title, severity, timeline, decisions, tasks, etc.) |
| `dashboard_metrics` | Dashboard numbers (open incidents, MTTR, etc.) |
| `shift_handoffs` | Current shift handoff status |
| `memory_chats` | Memory search conversation history |

Each row holds a JSON document — flexible enough for complex incident data without dozens of joined tables.

### Why CockroachDB?

- **Cloud-hosted** — no database server to manage on your laptop
- **Always available** — data persists even if you close the browser
- **SQL-compatible** — works with standard PostgreSQL tools and drivers
- **Scales globally** — built for production workloads (same DB from demo to real ops)

### MCP (Model Context Protocol)

Separately from the website, you can connect **Cursor** to CockroachDB via MCP (`.cursor/mcp.json`). That lets the AI in your IDE query the database directly — useful for development, not required to use the dashboard.

### AI + Vector Memory (AWS Bedrock)

When `BEDROCK_ENABLED=true`:

| Feature | Powered by |
|---------|------------|
| Incident Intake extraction | Claude Haiku 4.5 |
| Agent Console reasoning | Amazon Nova 2 Lite |
| Memory Search answers | Nova 2 Lite + CockroachDB vector search |
| Similar incident matching | Titan embeddings → `incident_embeddings` table |

Quick setup:

```bash
npm run db:seed      # tables + sample data
npm run db:embed     # embed incidents into vector index
npm run dev:all
```

Full guide: [docs/BEDROCK_VECTOR_SETUP.md](docs/BEDROCK_VECTOR_SETUP.md)

---

## Project Structure

```
OPSRELAYDashboard/
├── src/                    # React frontend
│   ├── components/         # UI components (dashboard, intake, memory, tasks)
│   ├── services/           # apiService.ts + crdbClient.ts (API calls)
│   ├── data/               # Sample/mock data
│   └── types/              # TypeScript types
├── server/                 # Express API backend
│   ├── routes/             # REST endpoints
│   ├── schema.sql          # Database table definitions
│   └── scripts/seedDb.ts   # Load sample data into CockroachDB
├── .cursor/mcp.json        # Cursor MCP config (optional)
└── .env                    # Database URL and settings (not committed to git)
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [CockroachDB Cloud](https://cockroachlabs.cloud) cluster (free tier works)
- Your connection string from **Cloud Console → Connect**

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and add your CockroachDB connection string:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@CLUSTER.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
PORT=3001
VITE_USE_CRDB=true
VITE_API_URL=/api
```

### 3. Seed the database

Creates tables and loads sample incidents:

```bash
npm run db:seed
```

Expected output:

```
Schema applied.
Seeded 4 incidents, metrics, handoff, and 2 chat messages.
```

### 4. Run the website

```bash
npm run dev:all
```

| Service | URL |
|---------|-----|
| **Website** | http://localhost:5173 |
| **API health check** | http://localhost:3001/api/health |

Look for the green **CRDB Live** badge in the header — that means the app is connected to CockroachDB.

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Start frontend + API together (recommended) |
| `npm run dev` | Frontend only (uses browser localStorage, no database) |
| `npm run dev:server` | API server only |
| `npm run db:seed` | Reset tables and reload sample data |
| `npm run build` | Production build |
| `node servers/test-db.js` | Test raw CockroachDB connection |

---

## Check If the Database Is Empty

**Via API** (with `npm run dev:all` running):

```powershell
(Invoke-RestMethod http://localhost:3001/api/incidents).Count
```

- `0` = empty
- `4` = seeded with sample data

**Via SQL** (CockroachDB Cloud SQL Shell):

```sql
SELECT count(*) FROM incidents;
```

If empty, run `npm run db:seed`.

---

## Two Data Modes

| Mode | Setting | Where data lives |
|------|---------|------------------|
| **Demo** | `VITE_USE_CRDB=false` | Browser localStorage only |
| **Production** | `VITE_USE_CRDB=true` | CockroachDB via API |

Use `VITE_USE_CRDB=true` for the full experience with persistent cloud storage.

---

## Security (August 2026 hardening)

Recent changes address the hackathon readiness review:

| Area | Implementation |
|------|----------------|
| **Authorization** | `canEditIncident` — only owners/admins may mutate incidents or tasks; viewers are read-only |
| **Incident IDs** | Server-generated on `POST /incidents`; client IDs ignored |
| **AI extraction** | Zod schema validation; malformed Bedrock JSON returns `422 analysis_failed` |
| **Secrets** | AWS keys/private keys blocked; bearer tokens/JWTs redacted before Bedrock/embed |
| **Embeddings** | 1024-dim + finite validation; Titan/local spaces not mixed in production |
| **Vector search** | Auth-scoped results, similarity threshold (55%), embedding provenance columns |
| **Re-index** | `POST /agent/index` restricted to admin role |
| **Seeding** | `db:seed` requires `ALLOW_DESTRUCTIVE_SEED=true` and refuses production |
| **Errors** | Sanitized public error messages (no stack/SQL leaks) |
| **Tests** | `npm run test` — auth, redaction, embedding, schema unit tests |
| **License** | MIT (`LICENSE`) |

**Still recommended before public demo:** HTTPS on EC2, rotate demo credentials, CockroachDB Managed MCP read-only investigator, full versioned migration tool, agent-run audit table.

Destructive seed example:

```bash
ALLOW_DESTRUCTIVE_SEED=true npm run db:seed
```

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **Backend:** Express, Node.js
- **Database:** CockroachDB Cloud (PostgreSQL-compatible)
- **Icons:** Lucide React

---

## License

Private project — for demo and development use.

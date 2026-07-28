# CockroachDB + MCP Setup for OpsRelay

This guide covers two integrations:

1. **CockroachDB as the app database** — incidents, tasks, and memory chat stored in CRDB
2. **CockroachDB MCP server in Cursor** — lets the AI agent query your cluster directly while you develop

---

## Part 1: CockroachDB for the OpsRelay App

### Option A — Local CockroachDB (quickest for demo)

```bash
# Install CockroachDB: https://www.cockroachlabs.com/docs/stable/install-cockroachdb
cockroach start-single-node --insecure --listen-addr=localhost:26257
```

In a second terminal:

```bash
cp .env.example .env
npm install
npm run db:seed      # creates schema + loads sample incidents
npm run dev:all      # starts API (3001) + Vite frontend (5173)
```

Open http://localhost:5173 — the dashboard now reads/writes via CockroachDB.

Verify the API:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","database":"cockroachdb",...}
```

### Option B — CockroachDB Cloud

1. Create a free cluster at [cockroachlabs.cloud](https://cockroachlabs.cloud)
2. Create database `opsrelay`
3. Copy the connection string from **Connect → General connection string**
4. Set in `.env`:

```
DATABASE_URL=postgresql://<user>:<password>@<host>:26257/opsrelay?sslmode=verify-full
VITE_USE_CRDB=true
```

5. Run `npm run db:seed` then `npm run dev:all`

### How the frontend switches backends

| Mode | Env | Data source |
|------|-----|-------------|
| Demo (default) | `VITE_USE_CRDB=false` | Browser localStorage |
| Production | `VITE_USE_CRDB=true` | Express API → CockroachDB |

The service layer in `src/services/apiService.ts` delegates to `src/services/crdbClient.ts` when CRDB mode is on. Vite proxies `/api` → `localhost:3001` (see `vite.config.ts`).

### Schema

Tables in `server/schema.sql`:

- `incidents` — full incident JSON (timeline, decisions, tasks embedded)
- `dashboard_metrics` — telemetry snapshot
- `shift_handoffs` — current shift handoff state
- `memory_chats` — memory search conversation history

---

## Part 2: CockroachDB MCP Server in Cursor

MCP lets Cursor's AI agent run SQL, inspect schemas, and manage your CockroachDB cluster from chat — separate from the React app.

### Option A — Managed MCP (CockroachDB Cloud, recommended)

1. Open [CockroachDB Cloud Console](https://cockroachlabs.cloud)
2. Go to your cluster → **Connect** → select **MCP**
3. Choose **Cursor** and click **Add to Cursor**

   Or manually create `.cursor/mcp.json` (copy from `.cursor/mcp.json.example`):

```json
{
  "mcpServers": {
    "cockroachdb-cloud": {
      "url": "https://cockroachlabs.cloud/mcp",
      "headers": {
        "mcp-cluster-id": "YOUR_CLUSTER_ID"
      }
    }
  }
}
```

4. **Restart Cursor**
5. Open **Cursor Settings → MCP** → select `cockroachdb-cloud` → **Authenticate**
6. Approve read/write scopes in the browser OAuth flow

After auth, you can ask Cursor things like:

- "Show me all tables in the opsrelay database"
- "How many open SEV-1 incidents are in the incidents table?"
- "Create an index on incidents for severity"

Docs: [Connect to the CockroachDB Cloud MCP server](https://www.cockroachlabs.com/docs/cockroachcloud/connect-to-the-cockroachdb-cloud-mcp-server)

### Option B — Self-hosted MCP (local CockroachDB)

For a local cluster, use the community MCP server:

**Prerequisites:** [uv](https://docs.astral.sh/uv/) installed

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cockroachdb-local": {
      "command": "uvx",
      "args": [
        "--from", "git+https://github.com/amineelkouhen/mcp-cockroachdb.git",
        "cockroachdb-mcp-server",
        "--url", "postgresql://root@localhost:26257/opsrelay?sslmode=disable"
      ]
    }
  }
}
```

Restart Cursor. The agent can then query your local `opsrelay` database directly.

### Authentication options (Cloud)

| Method | Use case | Config |
|--------|----------|--------|
| OAuth (PKCE) | Interactive dev in Cursor | URL only, authenticate in UI |
| API key | Headless / CI agents | Add `Authorization: Bearer <key>` header |
| OAuth + cluster scope | Restrict to one cluster | Add `mcp-cluster-id` header |

---

## Architecture

```
┌─────────────────┐     /api      ┌──────────────────┐     SQL      ┌──────────────┐
│  React Frontend │ ────────────► │  Express Server  │ ───────────► │ CockroachDB  │
│  (Vite :5173)   │               │  (Node :3001)    │              │  opsrelay DB │
└─────────────────┘               └──────────────────┘              └──────────────┘

┌─────────────────┐     MCP       ┌──────────────────┐     SQL      ┌──────────────┐
│  Cursor IDE     │ ────────────► │  CRDB MCP Server │ ───────────► │ CockroachDB  │
│  (AI Agent)     │               │  (Cloud or local)│              │  (same cluster)│
└─────────────────┘               └──────────────────┘              └──────────────┘
```

The React app and Cursor MCP are **independent** — both talk to the same CockroachDB cluster but through different paths.

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Frontend only (localStorage mode) |
| `npm run dev:server` | API server only |
| `npm run dev:all` | Frontend + API together |
| `npm run db:seed` | Apply schema and seed sample data |
| `npm run build` | Production frontend build |

---

## Troubleshooting

**`Database unreachable` on /api/health**
- Ensure CockroachDB is running: `cockroach sql --url "postgresql://root@localhost:26257/defaultdb?sslmode=disable" -e "SELECT 1"`
- Check `DATABASE_URL` in `.env`

**Frontend still uses localStorage**
- Set `VITE_USE_CRDB=true` in `.env` and restart Vite

**MCP auth fails in Cursor**
- Restart Cursor after editing `.cursor/mcp.json`
- For Cloud: ensure your user has Cluster Admin or Cluster Operator role
- For custom clients: allowlist redirect URL in Cloud Console

**Seed fails with connection error**
- Local: start CockroachDB first with `cockroach start-single-node --insecure`
- Cloud: verify SSL mode is `verify-full` in connection string

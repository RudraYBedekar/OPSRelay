# OpsRelay Setup Guide — July 26, 2026

Step-by-step guide to run the **AI Agent + Vector Indexing** stack.  
Bedrock setup comes **after** — the agent works today with local vectors.

---

## What's built (ready now)

| Feature | Status | Works without Bedrock? |
|---------|--------|----------------------|
| CockroachDB `Rudra` database | Ready | Yes |
| 10 synthetic incidents (July 26 data) | Ready | Yes |
| Vector index (`incident_embeddings`) | Ready | Yes (local embeddings) |
| AI Agent Console (sidebar tab) | Ready | Yes (local mode) |
| Memory Search | Ready | Yes |
| Bedrock Claude + Titan | **You set up next** | No |

---

## Step 1 — Install & configure (5 min)

```powershell
cd C:\Users\rudra\OneDrive\Desktop\githubproject\OPSRELAYDashboard
npm install
```

Your `.env` should have:

```env
CRDB_DATABASE=Rudra
DATABASE_URL=postgresql://USER:PASSWORD@CLUSTER.cockroachlabs.cloud:26257/Rudra?sslmode=verify-full
PORT=3001
VITE_USE_CRDB=true
VITE_API_URL=/api
BEDROCK_ENABLED=false
AWS_REGION=us-east-1
```

---

## Step 2 — Seed database + vector index (2 min)

```powershell
npm run db:seed
```

This will:
1. Create database **`Rudra`** (if missing)
2. Load **10 incidents** with July 26, 2026 timestamps
3. Build **vector index** automatically (local embeddings)

Expected output:

```
Seeded 10 incidents...
Vector index: 28 chunks (28 rows) via local mode.
```

Verify in CockroachDB Cloud SQL Shell:

```sql
USE "Rudra";
SELECT count(*) FROM incidents;
SELECT count(*) FROM incident_embeddings;
```

---

## Step 3 — Run the app (1 min)

```powershell
npm run dev:all
```

Open: **http://localhost:5173**

---

## Step 4 — Test AI Agent (no Bedrock yet)

1. Click **AI Agent Console** in the sidebar
2. Status bar should show:
   - `CRDB Rudra`
   - `local vectors · 28 chunks`
   - `Local mode (add Bedrock later)`
3. Click a quick prompt or type:
   > What fixed similar CockroachDB connection pool issues before?
4. Click **Run Agent**

You should see:
- Agent execution steps (embed → vector search → synthesize)
- Similar incident cards with % match
- Suggested tasks
- Triage severity/service

---

## Step 5 — Verify API directly

```powershell
Invoke-RestMethod http://localhost:3001/api/agent/status
Invoke-RestMethod -Method POST http://localhost:3001/api/agent/run `
  -ContentType "application/json" `
  -Body '{"query": "Have we seen Kong rate limit issues before?"}'
```

---

## Step 6 — AWS Bedrock setup (when you're ready)

### 6a. Enable models in AWS Console

1. [AWS Console](https://console.aws.amazon.com) → **Amazon Bedrock** → **Model access**
2. Enable:
   - **Anthropic Claude Haiku 4.5** (AI Intake)
   - **Amazon Nova 2 Lite** (Agent Console)
   - **Amazon Titan Text Embeddings V2** (vectors)

### 6b. Create IAM user

- Policy: `bedrock:InvokeModel`
- Create access key → copy ID + secret

### 6c. Update `.env`

```env
BEDROCK_ENABLED=true
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_LLM_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_AGENT_MODEL=us.amazon.nova-2-lite-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
BEDROCK_EMBED_DIMENSIONS=1024
```

### 6d. Rebuild vector index with Titan embeddings

```powershell
npm run db:embed
npm run dev:all
```

Agent status should now show **Haiku + Nova 2 Lite** + **bedrock vectors**.

### 6e. Test Bedrock

```powershell
Invoke-RestMethod http://localhost:3001/api/bedrock/test
```

Expected: `{ "llm": true, "agent": true, "embed": true }`

---

## July 26, 2026 — Active incidents in database

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| INC-8962 | API Gateway Rate Limiter — 429 Storm | SEV-1 | INVESTIGATING |
| INC-8941 | Auth-Service OOMKilled | SEV-0 | OPEN |
| INC-8942 | CockroachDB Pool Exhaustion — Billing | SEV-1 | INVESTIGATING |
| INC-8965 | CockroachDB Replica Lag — Analytics | SEV-2 | OPEN |
| INC-8955 | CDN Cache Invalidation Storm | SEV-2 | MITIGATED |
| INC-8958 | Datadog Agent Memory Leak | SEV-3 | OPEN |
| INC-8938 | Stripe Webhook Failure | SEV-2 | RESOLVED |
| INC-8920 | Redis Split-Brain | SEV-1 | RESOLVED |
| INC-8970 | SendGrid Email Backlog | SEV-2 | RESOLVED |
| INC-8975 | Terraform State Lock | SEV-3 | RESOLVED |

---

## Commands cheat sheet

| Command | What it does |
|---------|--------------|
| `npm run db:seed` | Reset Rudra DB + load data + build vectors |
| `npm run db:embed` | Rebuild vector index only |
| `npm run setup:ai` | seed + embed |
| `npm run dev:all` | Start frontend + API |
| `node servers/test-db.js` | Check Rudra connection + row counts |

---

## Architecture (your stack today)

```
React UI → AI Agent Console
    ↓
Express API (/api/agent/run)
    ↓
1. Embed query (local now → Bedrock Titan later)
2. Vector search in CockroachDB Rudra.incident_embeddings
3. Load incident details from incidents table
4. Synthesize answer (Nova 2 Lite via Bedrock)
    ↓
Return: answer + similar incidents + suggested tasks
```

---

## Next after Bedrock

1. Set `BEDROCK_ENABLED=true`
2. Run `npm run db:embed` (re-index with Titan)
3. Agent uses Claude for extraction, memory, and agent responses
4. Optional: PagerDuty webhook → auto-trigger agent

Full Bedrock details: [BEDROCK_VECTOR_SETUP.md](./BEDROCK_VECTOR_SETUP.md)

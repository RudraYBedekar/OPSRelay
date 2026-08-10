# AWS Bedrock + CockroachDB Vector Setup (From Scratch)

Complete guide to enable **real AI extraction**, **semantic memory search**, and a **real-time agent** in OpsRelay.

---

## Overview

| Component | What it does |
|-----------|--------------|
| **AWS Bedrock (Claude)** | Parses incident notes, powers the AI agent |
| **AWS Bedrock (Titan Embeddings)** | Converts text → vectors for similarity search |
| **CockroachDB Vector Index** | Stores embeddings, fast "have we seen this before?" search |

```
Incident notes → Bedrock Claude → structured JSON (severity, tasks, timeline)
                      ↓
              Bedrock Titan → embedding vector
                      ↓
         CockroachDB incident_embeddings table (VECTOR index)
                      ↓
         Memory Search / Agent finds similar past incidents
```

---

## Part 1 — AWS Account Setup

### Step 1: Create / log into AWS

Go to [aws.amazon.com](https://aws.amazon.com) and sign in.

### Step 2: Enable Bedrock models

1. Open **AWS Console** → search **Amazon Bedrock**
2. Go to **Model access** (left sidebar)
3. Click **Manage model access** or **Enable specific models**
4. Enable these models:
   - **Anthropic → Claude Haiku 4.5** (AI Intake extraction)
   - **Amazon → Nova 2 Lite** (Agent Console reasoning)
   - **Amazon → Titan Text Embeddings V2** (vector search)
5. Save / submit — approval is usually instant for these models

### Step 3: Create IAM user for the API server

1. **IAM** → **Users** → **Create user**
2. Name: `opsrelay-bedrock`
3. Attach policy (create inline policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "*"
    }
  ]
}
```

4. Create user → **Security credentials** → **Create access key**
5. Choose **Application running outside AWS**
6. Copy **Access key ID** and **Secret access key** (shown once)

> **Alternative:** Use `aws configure` CLI profile instead of keys — the SDK picks up `~/.aws/credentials` automatically if keys are omitted from `.env`.

---

## Part 2 — CockroachDB Vector Table

Your cluster must support **VECTOR** type (CockroachDB v25.2+). You have v26.2 — you're good.

The schema is in `server/schema.sql`. It creates:

```sql
incident_embeddings (
  incident_id, chunk_type, content, service,
  embedding VECTOR(1024)   -- matches Titan Embeddings v2
)
CREATE VECTOR INDEX ... vector_cosine_ops
```

Apply it by running:

```bash
npm run db:seed
```

---

## Part 3 — Configure Environment

Create `.env` in the project root using [CONFIGURATION.md](CONFIGURATION.md):

```bash
# Create and edit .env with your secrets (never commit this file)
nano .env
```

Add your values:

```env
# Existing CockroachDB connection
DATABASE_URL=postgresql://USER:PASSWORD@CLUSTER.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full

PORT=3001
VITE_USE_CRDB=true
VITE_API_URL=/api

# Enable Bedrock
BEDROCK_ENABLED=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Models (must match what you enabled in Bedrock Console)
BEDROCK_LLM_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_AGENT_MODEL=us.amazon.nova-2-lite-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
BEDROCK_EMBED_DIMENSIONS=1024
```

**Important:** `BEDROCK_EMBED_DIMENSIONS=1024` must match Titan v2 and the `VECTOR(1024)` column in schema.

---

## Part 4 — Install & Seed

```bash
npm install
npm run db:seed          # Creates tables + sample incidents
npm run db:embed         # Calls Bedrock Titan → stores vectors in CRDB
```

Or one command:

```bash
npm run setup:ai
```

Expected output from `db:embed`:

```
Embedding all incidents into CockroachDB vector index...
Done. Indexed 12 chunks (12 total rows in incident_embeddings).
```

---

## Part 5 — Run the App

```bash
npm run dev:all
```

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | Dashboard |
| http://localhost:3001/api/health | DB + Bedrock status |
| http://localhost:3001/api/bedrock/test | Full Bedrock connectivity test |
| http://localhost:3001/api/memory/status | Vector search mode |

### Health check example

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Expected when everything works:

```json
{
  "status": "ok",
  "database": "cockroachdb",
  "bedrock": {
    "enabled": true,
    "extractModel": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "agentModel": "us.amazon.nova-2-lite-v1:0",
    "embedModel": "amazon.titan-embed-text-v2:0"
  },
  "vectors": {
    "embeddingCount": 12,
    "dimensions": 1024
  }
}
```

### Test Bedrock directly

```powershell
Invoke-RestMethod http://localhost:3001/api/bedrock/test
```

Expected: `{ "llm": true, "agent": true, "embed": true }`

---

## Part 6 — Test Each Feature

### AI Extraction (Incident Intake)

1. Open **Incident Intake** tab
2. Paste notes → **Extract with AI**
3. Bedrock Claude returns severity, timeline, tasks
4. Response includes `"source": "bedrock"` in API (check Network tab)

### Vector Memory Search

1. Open **Memory Search** tab
2. Ask: *"Have we seen CockroachDB connection pool exhaustion before?"*
3. Agent uses vector search → Bedrock Claude writes the answer
4. Related incident cards show real similarity scores

### Agent API (direct)

```powershell
Invoke-RestMethod -Method POST http://localhost:3001/api/agent/respond `
  -ContentType "application/json" `
  -Body '{"query": "What fixed similar billing-service DB issues?"}'
```

---

## Part 7 — How It Works in the Code

```
server/
├── config/bedrock.ts           # Env config
├── services/
│   ├── bedrockClient.ts        # AWS SDK wrapper
│   ├── embedService.ts         # Titan → vector[]
│   ├── llmService.ts           # Claude extraction + agent
│   ├── vectorService.ts        # CRDB vector index + search
│   ├── agentService.ts         # Orchestrates search + LLM
│   └── fallbackExtract.ts      # Works when Bedrock is off
├── routes/
│   ├── extract.ts              # POST /api/extract
│   ├── memory.ts               # POST /api/memory/query
│   └── agent.ts                # POST /api/agent/respond
└── scripts/
    └── embedIncidents.ts       # npm run db:embed
```

### When a new incident is saved

1. Incident JSON → `incidents` table
2. Background: summary + notes + fixes → Titan embeddings
3. Vectors → `incident_embeddings` table

### When Memory Search runs

1. User question → Titan embedding
2. CockroachDB: `ORDER BY embedding <=> query_vector LIMIT 5`
3. Top matches + incident context → Claude agent prompt
4. Agent response saved to `memory_chats`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `AccessDeniedException` on Bedrock | Enable models in Bedrock Console; check IAM policy |
| `Could not connect to the endpoint URL` | Wrong `AWS_REGION` — Bedrock must be in a supported region (e.g. `us-east-1`) |
| `embeddingCount: 0` | Run `npm run db:embed` after seed |
| Vector search fails | Re-run `npm run db:seed` (recreates vector index) |
| Extraction uses fallback | Set `BEDROCK_ENABLED=true`; check `/api/bedrock/test` |
| `ValidationException` on embed model | Use `amazon.titan-embed-text-v2:0` with `BEDROCK_EMBED_DIMENSIONS=1024` |
| Slow first request | Normal — cold start on Bedrock; subsequent calls are faster |

### Check vector rows in SQL

In CockroachDB Cloud SQL Shell:

```sql
SELECT count(*) FROM incident_embeddings;
SELECT incident_id, chunk_type, left(content, 60) FROM incident_embeddings LIMIT 5;
```

---

## Cost Notes (AWS Bedrock)

| Model | Approx. use in OpsRelay |
|-------|-------------------------|
| Claude Haiku 4.5 | ~$0.001 per extraction (AI Intake) |
| Nova 2 Lite | ~$0.003 per agent chat |
| Titan Embeddings v2 | ~$0.0001 per incident indexed |

For demo/dev with sample data, total cost is usually **under $1/month**.

---

## Fallback Mode

If `BEDROCK_ENABLED=false` or AWS fails:

- Extraction uses rule-based logic (`fallbackExtract.ts`)
- Memory search uses keyword matching
- App still runs — just without real AI

---

## Next Steps

1. Wire **PagerDuty/Datadog webhooks** → auto-trigger agent on alerts
2. Add **human approval** before agent executes remediation
3. Store **runbook embeddings** for richer RAG context
4. Use **Bedrock Agents** SDK for multi-step tool use

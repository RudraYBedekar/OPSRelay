# OpsRelay Dashboard — Hackathon Judge Review

**Review date:** July 28, 2026  
**Reviewer role:** CockroachDB × AWS Hackathon judge (simulated)  
**Project:** OpsRelay — AI Incident Response & Shift Handoff Dashboard  
**Methodology:** Code inspection, live API verification, automated E2E tests, build verification, DB/vector checks. **Nothing assumed without evidence.**

---

## Executive Summary

OpsRelay is a **functional, well-scoped demo** that combines a React operations dashboard with an Express API, **CockroachDB Cloud** persistence, **AWS Bedrock** (Haiku + Nova + Titan), and **native CockroachDB vector search** (`incident_embeddings` + cosine distance). The core happy path works and is backed by **9/9 passing E2E tests** at review time.

However, several **hackathon sponsor integrations are partial, documentation-only, or missing**: no **S3 / Lambda / ECS / EKS**, no **authentication**, **no dedicated GitHub repository**, **Memory Search UI removed** (merged into Ask AI while README still claims it), **static dashboard metrics**, and **MCP / ccloud CLI / Agent Skills** are developer-side only—not part of the running product.

**Overall score: 72 / 100** — Strong technical demo with real CRDB + Bedrock; loses points on sponsor breadth, production readiness, repo hygiene, and documentation accuracy.

---

## Verification Evidence (Live Run)

| Check | Result | Evidence |
|-------|--------|----------|
| API health | ✅ Pass | `GET /api/health` → `status: ok`, DB cockroachdb, Bedrock enabled |
| Bedrock LLM (Haiku) | ✅ Pass | `GET /api/bedrock/test` → `llm: true` |
| Bedrock Agent (Nova) | ✅ Pass | `agent: true` |
| Bedrock Embeddings (Titan) | ✅ Pass | `embed: true` |
| Vector index | ✅ Pass | 59 rows, 1024 dimensions, `idx_incident_embeddings_vector` in schema |
| Agent + vector search | ✅ Pass | E2E: Ask AI → `bedrock mode`, 5 matches, 1502 chars |
| AI extraction | ✅ Pass | E2E: log-013 → SEV-0 / checkout-api via Bedrock |
| Persist incident | ✅ Pass | E2E: `INC-E2E-*` written to `incidents` table |
| Task update | ✅ Pass | E2E: task status PATCH persisted |
| Production build | ✅ Pass | `npm run build` succeeded |
| E2E suite | ✅ Pass | **9 passed, 0 failed** |
| CockroachDB connection | ✅ Pass | `npm run test:db` → database `Rudra`, 20 incidents, 59 embeddings |

**Database snapshot at review:**

| Table | Rows |
|-------|------|
| incidents | 20 |
| incident_embeddings | 59 |
| sample_logs | 19 |
| memory_chats | 4 |
| shift_handoffs | 1 |
| dashboard_metrics | 1 |

---

## End-to-End User Flow Validation

| Step | Status | Notes |
|------|--------|-------|
| Load dashboard | ✅ | Metrics, handoff, incident table from CRDB |
| Shift handoff (Rudra → Yash) | ✅ | From `shift_handoffs` seed/API; names in `mockData.ts` |
| Global search / filters | ✅ | Client-side on incident table |
| New Incident — Quick add | ✅ | Saves to `incidents`; optional `sample_logs` |
| New Incident — AI extract | ✅ | Bedrock Haiku → review → save |
| Ask AI | ✅ | Vector search + Nova reasoning |
| Task board | ✅ | Kanban + list; status updates persist |
| Incident detail | ✅ | Timeline, tasks, decisions, raw logs |
| Memory Search (standalone tab) | ⚠️ | **Removed from UI**; logic merged into Ask AI. `MemorySearchChat.tsx` exists but is **not mounted** in `App.tsx` |
| Persistent memory (chat history) | ⚠️ | `memory_chats` table + `/api/memory/query` exist; **UI no longer exposes Memory Search chat** |

---

## CockroachDB Sponsor Requirements

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **CockroachDB as primary database** | ✅ **Verified** | All incidents, handoffs, metrics, sample logs, embeddings in CRDB Cloud (`Rudra`) |
| **Distributed Vector Indexing** | ✅ **Verified** | `CREATE VECTOR INDEX idx_incident_embeddings_vector ON incident_embeddings (service, embedding vector_cosine_ops)` in `server/schema.sql`; searches use `<=>` cosine distance in `vectorService.ts` |
| **MCP Server** | ⚠️ **Partial** | Config at `.agents/mcp.json` (cluster ID present). **Not integrated into the web app**—Cursor IDE tooling only. README references `.cursor/mcp.json` but file is under `.agents/`. Not demonstrated in product demo flow |
| **ccloud CLI** | ❌ **Not integrated** | Mentioned in setup docs for local CRDB only; no scripts or app features use `ccloud` |
| **Agent Skills** | ❌ **Not found** | No CockroachDB Agent Skills configuration or usage in codebase |
| **Multi-region / distribution story** | ⚠️ **Weak** | CRDB Cloud used, but app does not demonstrate geo-distribution, survivability, or follower reads |

**Vector/RAG pipeline (verified):**

```
Incident text → embedService (Titan v2) → incident_embeddings (VECTOR 1024)
User query → embed → cosine search → top incidents → Nova agent answer
```

Fallback: local embeddings + keyword search when Bedrock/index empty (`agentService.ts`).

---

## AWS Sponsor Requirements

| Service | Status | Evidence |
|---------|--------|----------|
| **Amazon Bedrock — Claude Haiku 4.5** | ✅ **Verified** | `BEDROCK_LLM_MODEL`, `/api/extract`, E2E extract pass |
| **Amazon Bedrock — Nova 2 Lite** | ✅ **Verified** | `BEDROCK_AGENT_MODEL`, `/api/agent/run`, E2E agent pass |
| **Amazon Bedrock — Titan Embed v2** | ✅ **Verified** | `BEDROCK_EMBED_MODEL`, 1024-dim vectors, `embedMode: bedrock` |
| **S3** | ❌ **Not used** | No SDK, buckets, or file storage |
| **Lambda** | ❌ **Not used** | No functions, SAM, or serverless deploy |
| **ECS / EKS** | ❌ **Not used** | No containers, task defs, or k8s manifests |
| **Cognito / IAM auth for users** | ❌ **Not used** | API is open; only IAM for Bedrock backend |
| **CloudWatch / observability** | ⚠️ **Docs only** | No app-level metrics, tracing, or alarms |

**AWS integration depth:** Bedrock is **real and well-used** (3 models, clear separation of roles). **No broader AWS architecture** beyond Bedrock Runtime API calls.

---

## Feature-by-Feature Audit

### Working well ✅

- **CRDB persistence** — incidents, tasks (JSON in incidents), handoffs, sample logs
- **AI intake extraction** — structured severity, timeline, tasks, executive summary
- **Quick add intake** — minimal form → DB without AI
- **RAG / vector search** — Titan embeddings + CRDB vector queries
- **Ask AI agent** — context from similar incidents + Nova response
- **Automated E2E tests** — rare and strong for a hackathon project
- **Fallback paths** — local embed + keyword search if Bedrock/index unavailable
- **UI polish** — light theme, responsive sidebar, toasts, loading states
- **Developer docs** — `WHAT_WE_BUILT.md`, Bedrock setup, SQL cheat sheet

### Broken or misleading ⚠️

| Issue | Severity | Detail |
|-------|----------|--------|
| **README outdated** | Medium | Claims dark theme, "Memory Search" tab, 4 seeded incidents; reality: light UI, Ask AI only, ~10+ incidents |
| **Static dashboard metrics** | Medium | `dashboard_metrics` is seeded JSON; **not recalculated** when incidents/tasks change via UI |
| **Memory Search UI orphaned** | Medium | `MemorySearchChat.tsx` + `/api/memory/query` exist; **not in navigation** |
| **GitHub repository** | **High** | Project folder is **untracked** (`??`) inside parent repo whose `origin` is **PetToyrecommnder** — judges cannot clone OpsRelay cleanly |
| **No deployment** | High | No Dockerfile, no CI/CD, no hosted demo URL |
| **No authentication** | High | Open API; anyone with URL can read/write incidents |
| **`.env` secrets risk** | High | AWS keys + DB creds in local `.env`; must never be committed (`.gitignore` covers `.env`) |

### Not implemented ❌

- User login / RBAC
- S3 log archive, Lambda triggers, ECS/EKS hosting
- ccloud CLI automation in repo
- CockroachDB Agent Skills
- Rate limiting / API keys
- Automated vector re-index on all code paths (Quick add indexes only if `BEDROCK_ENABLED` on POST `/api/incidents`)
- Real-time metrics from live incident counts

---

## Security Review

| Area | Finding |
|------|---------|
| **API auth** | ❌ None — all routes public |
| **CORS** | `cors()` open on Express |
| **Secrets** | Bedrock keys in `.env`; MCP cluster ID in `.agents/mcp.json` |
| **Input validation** | Minimal — JSON bodies trusted; 2MB limit only |
| **SQL injection** | ✅ Parameterized queries via `pg` |
| **XSS** | React default escaping; agent answers rendered as text (low risk) |
| **Production secrets** | No Secrets Manager / Parameter Store |

**Judge note:** Acceptable for local hackathon demo; **not production-ready**.

---

## Performance & Scalability

| Area | Assessment |
|------|------------|
| Vector search | Uses CRDB `<=>` with vector index; fine for demo scale (59 vectors) |
| Embedding on save | Async fire-and-forget; failures only logged |
| N+1 / full table scans | Agent loads all incidents each request — OK for demo, weak at scale |
| Frontend bundle | ~300 KB gzip JS — reasonable |
| No caching | Every dashboard load hits CRDB for all incidents |

---

## UI/UX Review

**Strengths:** Clean light ops theme, clear nav (Dashboard / New Incident / Ask AI / Tasks), Quick add vs AI extract toggle, structured agent response sections, mobile-friendly table cards.

**Weaknesses:**

- README promises features UI no longer has
- Dashboard metrics can disagree with incident table (static seed)
- No demo video link or architecture diagram in repo root
- Handoff names require re-seed if DB stale

---

## GitHub Repository Assessment

| Criterion | Status |
|-----------|--------|
| Dedicated OpsRelay repo | ❌ **Missing** — nested under `githubproject/`, untracked |
| Correct remote URL | ❌ Points to unrelated Pet Toy Recommender |
| README accuracy | ❌ Outdated |
| License / contribution guide | ⚠️ "Private project" only |
| CI (GitHub Actions) | ❌ No `.github/workflows` |
| Issue templates / demo script | ❌ Missing |

**This is the single biggest risk for hackathon judging** — judges often score repository clarity and reproducibility heavily.

---

## Hackathon Scoring (100 points)

| Category | Weight | Score | Rationale |
|----------|--------|-------|-----------|
| **Problem & story** | 10 | 8 | Clear on-call / handoff pain; relatable ops scenario |
| **CockroachDB usage** | 20 | 17 | Real CRDB Cloud, JSONB incidents, **vector index + search** — excellent core use |
| **AWS usage** | 20 | 14 | Bedrock triple-model stack works; **no S3/Lambda/ECS/EKS** |
| **MCP / ccloud / Agent Skills** | 10 | 3 | MCP config exists for Cursor only; ccloud & Agent Skills absent |
| **Technical execution** | 20 | 18 | E2E tests, working RAG, clean architecture, TypeScript strict |
| **UX & demo readiness** | 10 | 8 | Polished UI; metrics/memory doc mismatches hurt demo trust |
| **Documentation & repo** | 5 | 2 | Good docs exist but README stale; **no proper GitHub repo** |
| **Production / security** | 5 | 2 | No auth, no deploy, open API |

### **Total: 72 / 100**

**Tier:** Strong **regional finalist** potential if demo and sponsor story are told well live; **unlikely to win grand prize** without repo fix, AWS breadth, and auth/deploy story.

---

## Strengths (Lead with these in your pitch)

1. **Real distributed vector search in CockroachDB** — not a sidecar vector DB; embeddings live in `incident_embeddings` with vector index.
2. **Three Bedrock models with clear roles** — Haiku extract, Nova agent, Titan embed.
3. **End-to-end verified** — `npm run test:e2e` proves extract → save → agent → tasks against live CRDB.
4. **Thoughtful ops UX** — shift handoff, severity workflow, Quick add for fast logging under pressure.
5. **Honest fallbacks** — app works when Bedrock is off (degraded but functional).
6. **Substantial sample data** — 19 logs, 20 incidents, 59 vector chunks for convincing demo.

---

## Weaknesses (Judges will ask)

1. No **dedicated GitHub repo** — project not cleanly submittable today.
2. **No AWS beyond Bedrock** — sponsor checklist items (S3, Lambda, etc.) unchecked.
3. **MCP / ccloud / Agent Skills** not shown in the **application** — only dev tooling/docs.
4. **No authentication** — not enterprise credible.
5. **README lies** about UI (dark theme, Memory Search tab, incident count).
6. **Dashboard metrics don't update** when you add incidents in the UI.
7. **Memory Search** component dead code; persistent chat memory not exposed in UI.
8. **No cloud deployment** — judges must run locally.

---

## Missing Sponsor / Rubric Items Checklist

- [ ] CockroachDB MCP demonstrated in **demo video** (not just config file)
- [ ] ccloud CLI in setup script or Makefile
- [ ] CockroachDB Agent Skills
- [ ] AWS S3 (e.g. raw log archive)
- [ ] AWS Lambda (e.g. async embed on incident create)
- [ ] ECS/EKS or Amplify hosting
- [ ] Amazon Cognito or API Gateway auth
- [ ] Public demo URL
- [ ] Architecture diagram in README
- [ ] 2-minute demo script

---

## Prioritized Recommendations (Maximize win chance)

### P0 — Do before submission (1–2 hours)

1. **Create dedicated GitHub repo** `OpsRelayDashboard` — push only this folder; fix README.
2. **Update README** — light theme, Ask AI (not Memory Search tab), current models, `npm run test:e2e`, link to this review doc.
3. **Record 2-min demo video** — Quick add → AI extract → Ask AI vector match → show CRDB SQL `SELECT count(*) FROM incident_embeddings`.
4. **Add `ARCHITECTURE.md` diagram** — React → Express → CRDB + Bedrock flow.

### P1 — High impact (4–6 hours)

5. **Recompute metrics live** — derive `activeSev0Sev1`, `openTasksCount` from `incidents` table instead of static JSON.
6. **Wire Memory Search OR remove dead code** — either restore tab using `/api/memory/query` or delete `MemorySearchChat.tsx` and update docs.
7. **Deploy frontend + API** — e.g. Railway/Render/Fly.io + CRDB Cloud (already have); add URL to README.
8. **Basic API key auth** — header check on `/api/*` for demo credibility.

### P2 — Sponsor bonus points

9. **Lambda function** — S3 upload triggers async embed → CRDB (even minimal).
10. **MCP demo slide** — show Cursor querying `incidents` via CRDB MCP during presentation.
11. **ccloud one-liner** in README: `ccloud cluster list` + link to cluster used.
12. **CloudWatch** — log Bedrock token usage or API latency.

### P3 — Polish

13. GitHub Actions — run `npm run build` + `npm run test:e2e` on PR.
14. Remove fake wiki URLs in memory responses (`internal-wiki.opsrelay.io`).
15. Auto-update `dashboard_metrics` and `shift_handoffs` counts on incident save.

---

## Suggested Judge Demo Script (2 minutes)

1. **Dashboard** — "Live data from CockroachDB Cloud database `Rudra`" — show Live badge.
2. **Shift handoff** — Rudra → Yash, acknowledge.
3. **Quick add** — 3 lines of logs → Save → SQL: `SELECT id, data->>'title' FROM incidents ORDER BY created_at DESC LIMIT 1`.
4. **AI extract** — sample log → executive summary → save.
5. **Ask AI** — "What fixed similar DB connection pool errors?" → show vector matches + Nova sections.
6. **Proof** — `npm run test:e2e` or `/api/health` embedding count.

---

## Files Reviewed

- `src/App.tsx`, `server/index.ts`, `server/schema.sql`
- `server/services/llmService.ts`, `agentService.ts`, `vectorService.ts`, `embedService.ts`
- `server/routes/*`, `server/scripts/e2eTest.ts`, `checkVectors.ts`
- `README.md`, `docs/WHAT_WE_BUILT.md`, `docs/BEDROCK_VECTOR_SETUP.md`
- `.agents/mcp.json`, `.env.example`, `package.json`
- Live: `/api/health`, `/api/bedrock/test`, `/api/agent/status`, E2E suite

---

## Final Verdict

**OpsRelay delivers a credible, working CockroachDB + Bedrock incident-response demo with real vector RAG** — stronger than many hackathon submissions on integration depth for those two sponsors.

To **win**, you must fix **repository submission hygiene**, **align documentation with the UI**, and **expand the AWS story** (even one Lambda + S3 flow) while **demoing MCP** explicitly in the presentation.

**Recommended submission headline:**  
*"OpsRelay: CockroachDB-native vector memory + AWS Bedrock for AI incident intake and on-call handoff."*

---

*Generated from automated verification on July 28, 2026. Re-run `npm run test:e2e` and `npx tsx server/scripts/checkVectors.ts` before live judging.*

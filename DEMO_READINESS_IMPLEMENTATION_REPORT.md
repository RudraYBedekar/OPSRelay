# Demo-Readiness Remediation — Implementation Report

**Branch:** `codex/demo-readiness-remediation`  
**Base commit:** `c581300`  
**Date:** August 4, 2026  
**Status:** Implemented locally — **not committed/pushed** (awaiting your approval per plan)

---

## Baseline (Phase 0)

| Check | Before | After |
|-------|--------|-------|
| `npm run build:server` | Failed (~25 TS errors) | Pass |
| `npm run build` | Pass | Pass |
| `npm test` | 21 pass | **25 pass** |
| Working branch | `main` | `codex/demo-readiness-remediation` |

---

## What was fixed (senior engineer judgment)

### Phase 1 — TypeScript build
- Introduced `AccessViewer` minimal interface for authz helpers
- Fixed `incidents`, `tasks`, `extract`, `agentService`, `jobWorker`, `authService` typing
- Excluded `server/scripts` and `server/tests` from `tsconfig.server.json` (scripts import frontend `src/` and broke `rootDir`)
- **Approval via generic PATCH removed** — only analysis approve endpoint can set `analysisStatus: approved`

### Phase 2 — Migrations (no runtime DDL)
- Bootstrap ledger migration `20260802_000_schema_migrations.sql`
- Create `alert_embeddings` before owner-scope: `20260802_000b_alert_embeddings.sql`
- Job leases migration `20260802_004_job_leases.sql`
- Runner requires **`MIGRATION_DATABASE_URL`** (fail-closed if missing)
- Each migration runs in a transaction; version insert failure rolls back
- **Removed all DDL helpers from `server/index.ts` startup**
- Added `/api/health/live` and `/api/health/ready` + schema readiness checks
- Worker starts only when schema is ready

### Phase 3 — Save-first UI recoverability
- Frontend **separates** `createIntakeIncident` and `startAnalysis`
- Saved incident ID is shown immediately
- Analysis failure keeps the saved card + **Retry analysis** (does not say “Save failed”)
- IntakePanel renders failed/saved state without requiring `extractionResult`

### Phase 4 — Analysis consistency
- Idempotency returns the **exact** run for `(owner, incident, key)` via `ON CONFLICT DO NOTHING`
- Incident `analysisStatus` updated via `jsonb_set` (no stale full-JSON rewrite across Bedrock)
- Approval requires `review_required`; returns `ANALYSIS_ALREADY_APPROVED` / `ANALYSIS_NOT_REVIEWABLE`
- Sanitized error codes only (`BEDROCK_*`, `ANALYSIS_FAILED`, …)

### Phase 5 — Durable jobs
- Post-approval jobs inserted **inside** the approval transaction
- Job leases (`lease_owner`, `lease_expires_at`) with stale reclaim
- `job_effects` table prevents duplicate side effects on retry

### Phase 6–7 — Evidence + MCP honesty
- All evidence strings sanitized before projection; content-hash versioning
- MCP modes: `disabled` | `local_sql_demo` | `managed_mcp`
- **Never labels SQL fallback as Managed MCP**
- Managed MCP fail-closed unless real config is present (optional `MCP_ALLOW_SQL_BRIDGE` for controlled demos only)
- Investigator restricted to **admin** when auth is enabled
- Citations grounded against retrieved evidence IDs; citation cards show honest provider/mode

### Phase 9 (partial)
- Production CORS fail-closed if `CORS_ORIGIN` unset
- JSON body limit reduced to 1mb
- `.env.example` cleaned (no credential-shaped examples; documents `MIGRATION_DATABASE_URL`, `MCP_MODE`, `EVIDENCE_DATABASE_URL`)

---

## Intentionally not completed (needs your approval / credentials)

Per the plan’s safety rules, these were **not** done:

1. **Live CockroachDB migration apply** — show SQL + get explicit approval first  
2. **Real Streamable HTTP Managed MCP client** against a staging evidence cluster (needs `MCP_CLUSTER_ID` + `MCP_ACCESS_TOKEN` + evidence cluster)  
3. **Separate evidence cluster provisioning**  
4. **Commit / push / EC2 deploy** — waiting for your go-ahead  
5. Full Phase 10 integration test matrix against a disposable DB  

To run migrations when ready:

```bash
# Set MIGRATION_DATABASE_URL to a migration-owner credential (not runtime app user)
npm run db:migrate
```

For honest local evidence demos without claiming Managed MCP:

```env
MCP_MODE=local_sql_demo
```

---

## Demo-critical verification checklist

- [x] `npm run build:server` passes  
- [x] `npm run build` passes  
- [x] `npm test` passes (25)  
- [ ] Apply migrations with `MIGRATION_DATABASE_URL` (user approval)  
- [ ] Staging Managed MCP connect + write-deny proof  
- [ ] EC2 deploy with `CORS_ORIGIN` exact origins + HTTPS  

---

## Files touched (high level)

**New:** migrations `000`, `000b`, `004`; `schemaReadiness.ts`; `demoReadiness.test.ts`; this report  

**Rewritten/heavily changed:** `server/index.ts`, `runVersionedMigrations.ts`, `analysisService.ts`, `incidentJobService.ts`, `jobWorker.ts`, `mcp.ts`, `managedMcpClient.ts`, `investigatorService.ts`, `evidenceProjectionService.ts`, intake UI path in `App.tsx` / `IntakePanel.tsx`

---

## Recommended next step

1. Review this diff on branch `codex/demo-readiness-remediation`  
2. Approve commit (and optionally PR)  
3. Approve migration against staging with `MIGRATION_DATABASE_URL`  
4. Set `MCP_MODE=local_sql_demo` for demo until real Managed MCP staging is ready  

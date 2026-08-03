# Security & MCP Implementation — Change Log

**Date:** August 2, 2026  
**Based on:** `OPSRELAY_SECURITY_AND_MCP_IMPLEMENTATION_PLAN.md`  
**Status:** Implemented locally — build passing, 21 tests passing (not yet committed/deployed)

---

## Summary

This release implements three major outcomes from the security and MCP plan:

1. **Owner-scoped alert fatigue** — advisory duplicate detection after save (no pre-save blocking)
2. **Save-first incident intake** — incidents persist before any Bedrock/Titan/MCP work
3. **Read-only MCP investigator** — real evidence queries with citation cards in the UI

---

## Architecture Changes

### Save-first intake invariant

```text
User submits notes
    → POST /api/incidents (durable commit, analysisStatus: not_started)
    → POST /api/incidents/:id/analysis (Bedrock extraction, idempotent)
    → GET  /api/incidents/:id/analysis/current (poll status + jobs)
    → POST /api/incidents/:id/analysis/:runId/approve (human approval)
    → Background jobs: index_incident_vector | evaluate_alert_duplicate | project_mcp_evidence
```

No model, embedding, or MCP call runs before the incident row is committed.

### Alert fatigue (advisory)

```text
Before: evaluateAlert() on POST /incidents → HTTP 409 suppressed (incident never saved)
After:  incident always saved → job evaluates duplicate → duplicateCandidate on incident JSON
```

All alert vector queries filter by `owner_member_id`. API responses never include stored `alertText`.

### MCP investigator

```text
POST /api/investigator/query
    → mcpToolPolicy (read-only tools + SELECT-only SQL)
    → managedMcpClient (OAuth MCP or SQL fallback on incident_evidence)
    → investigatorService (Bedrock synthesis + real citations)
```

Only approved incidents are projected to `incident_evidence` (no raw notes, credentials, or auth data).

---

## New Files

### Backend

| File | Purpose |
|------|---------|
| `server/config/mcp.ts` | MCP env config and health status |
| `server/mcp/mcpToolPolicy.ts` | Allow/deny MCP tools; safe SELECT validation |
| `server/mcp/investigationQueries.ts` | Bounded query templates by intent |
| `server/mcp/managedMcpClient.ts` | Evidence SQL execution + MCP OAuth placeholder |
| `server/migrations/20260802_001_alert_tenant_scope.sql` | `owner_member_id` on `alert_embeddings` |
| `server/migrations/20260802_002_agent_runs_and_jobs.sql` | `agent_runs`, `incident_jobs` tables |
| `server/migrations/20260802_003_mcp_evidence_schema.sql` | `incident_evidence`, `schema_migrations` |
| `server/migrations/runVersionedMigrations.ts` | Versioned migration runner |
| `server/routes/analysis.ts` | Analysis start / current / approve endpoints |
| `server/routes/investigator.ts` | MCP status and query endpoints |
| `server/services/analysisService.ts` | Intake create, idempotent Bedrock runs, approval |
| `server/services/incidentJobService.ts` | Job enqueue, claim, complete, fail |
| `server/services/jobWorker.ts` | 15s interval worker for post-approval jobs |
| `server/services/investigatorService.ts` | MCP investigation + citation mapping |
| `server/services/evidenceProjectionService.ts` | Sanitized evidence projection |
| `server/types/analysis.ts` | Analysis and job type definitions |
| `server/tests/alertAuthorization.test.ts` | Alert access control tests |
| `server/tests/mcpToolPolicy.test.ts` | MCP tool and SQL policy tests |
| `server/tests/durableIntake.test.ts` | Save-first intake invariant tests |

### Frontend

| File | Purpose |
|------|---------|
| `src/types/investigator.ts` | MCP citation and investigation types |
| `src/components/agent/McpCitationCard.tsx` | Renders real MCP evidence citations |
| `src/components/alerts/DuplicateCandidateBanner.tsx` | “Possible duplicate” banner (incident already saved) |

---

## Modified Files

### Backend

| File | Changes |
|------|---------|
| `server/index.ts` | Mount analysis + investigator routes; run versioned migrations; start job worker |
| `server/routes/incidents.ts` | `POST /` is intake-only; removed pre-save alert eval and fire-and-forget indexing; PATCH enqueues jobs on `analysisStatus: approved` |
| `server/routes/alerts.ts` | Owner-scoped stats, mark-noise, override-distinct; removed public `POST /evaluate` |
| `server/routes/memory.ts` | Removed fabricated postmortem IDs, fake dates, and fake runbook URLs |
| `server/services/alertFatigueService.ts` | Owner-scoped vector search; `evaluateDuplicateCandidate()` (advisory); removed blocking `evaluateAlert()` |
| `server/services/incidentAccessService.ts` | Added `canViewAlertForIncident`, `canManageAlertForIncident`, `canUseInvestigator` |
| `server/scripts/runMigrations.ts` | Runs versioned SQL migrations |
| `.env.example` | Added `MCP_ENABLED`, `MCP_CLUSTER_ID`, `MCP_OAUTH_TOKEN`, etc. |

### Frontend

| File | Changes |
|------|---------|
| `src/App.tsx` | Save-first AI flow; removed `AlertSuppressedError` / 409 banner; approve workflow |
| `src/services/apiService.ts` | `saveAndAnalyzeIntake`, `startAnalysis`, `approveAnalysis`, investigator methods |
| `src/services/crdbClient.ts` | Intake, analysis, patch, investigator HTTP clients |
| `src/types/alertFatigue.ts` | `DuplicateCandidate`, `AnalysisRun`; removed suppression types |
| `src/types/incident.ts` | `analysisStatus`, `duplicateCandidate` fields |
| `src/components/intake/NotesForm.tsx` | Step labels: “Save & analyze”, “Review & approve” |
| `src/components/intake/IntakePanel.tsx` | Wired save-first props and approval flow |
| `src/components/intake/ExtractionResultView.tsx` | Approve & finalize (not save); shows saved incident ID and job status |
| `src/components/detail/IncidentDetailView.tsx` | Duplicate banner, MCP investigate panel, citation cards |
| `src/components/agent/AgentConsole.tsx` | MCP investigator mode toggle with citation display |
| `src/components/alerts/AlertFatigueCard.tsx` | Copy updated: “duplicate flags” not “suppressed” |

### Deleted

| File | Reason |
|------|--------|
| `src/components/alerts/AlertSuppressedBanner.tsx` | Replaced by `DuplicateCandidateBanner.tsx` |

---

## API Changes

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/incidents` | **Breaking:** intake only — `{ title?, rawNotes, shareWithMemberId? }` |
| `POST` | `/api/incidents/:id/analysis` | Start Bedrock extraction (`Idempotency-Key` header required) |
| `GET` | `/api/incidents/:id/analysis/current` | Latest run, jobs, and `analysisStatus` |
| `POST` | `/api/incidents/:id/analysis/:runId/approve` | Approve human-edited draft; enqueue background jobs |
| `GET` | `/api/investigator/status` | MCP health (operator/admin) |
| `POST` | `/api/investigator/query` | Read-only investigation `{ question, incidentId? }` |

### Removed / changed behavior

| Before | After |
|--------|-------|
| `POST /api/incidents` with full incident body | Intake fields only; use PATCH or approve for structured data |
| `POST /api/incidents` returns `409 suppressed` | Incident always saved; duplicate is advisory via jobs |
| `POST /api/alerts/evaluate` (public) | Removed; evaluation runs in background job only |
| Memory query returns fake postmortem/runbook citations | Returns only real incident IDs and search mode labels |

---

## Database Migrations

Run on startup (server) or manually:

```bash
npm run db:migrate
```

| Migration | Adds |
|-----------|------|
| `20260802_001_alert_tenant_scope` | `owner_member_id` column + owner-scoped vector index on `alert_embeddings` |
| `20260802_002_agent_runs_and_jobs` | `agent_runs`, `incident_jobs` |
| `20260802_003_mcp_evidence_schema` | `incident_evidence`, `schema_migrations` |

---

## Environment Variables (new)

```env
MCP_ENABLED=false
MCP_CLUSTER_ID=
MCP_OAUTH_TOKEN=
MCP_SERVER_URL=https://cockroachlabs.cloud/mcp
MCP_EVIDENCE_DATABASE=opsrelay_evidence
MCP_QUERY_TIMEOUT_MS=10000
MCP_MAX_RESULTS=10
```

When `MCP_ENABLED=true` without `MCP_OAUTH_TOKEN`, the backend uses SQL fallback against `incident_evidence` on the primary database.

---

## User-Facing UX Changes

### AI intake (New incident → AI extract)

1. **Step 1:** Paste logs  
2. **Step 2:** Save & analyze — incident saved immediately with real server ID  
3. **Step 3:** Review & approve — edit draft, then **Approve & finalize**

Toast message changed from *“AI extraction complete — review and save”* to *“Incident saved — AI draft ready for review”*.

### Quick add

Still one-click save, but internally: intake POST → PATCH with fields → `analysisStatus: approved` → background jobs.

### Alert fatigue

- No blocking banner at save time  
- Incident detail shows **Possible duplicate alert** if a similar pattern is found post-save  
- User can **Keep as distinct incident** or dismiss  

### Ask AI

- New mode: **MCP investigator** — returns read-only citations from approved evidence  
- Incident detail: **Investigate with MCP** panel  

---

## Tests

```bash
npm test        # 21 tests passing
npm run build   # TypeScript + Vite build succeeds
```

| Test file | Coverage |
|-----------|----------|
| `server/tests/security.test.ts` | Auth, redaction, embedding validation, extraction schema |
| `server/tests/alertAuthorization.test.ts` | Owner/viewer/stranger alert access |
| `server/tests/mcpToolPolicy.test.ts` | Denied write tools; SELECT-only SQL |
| `server/tests/durableIntake.test.ts` | Extraction validation, secret redaction, 409 semantics |

---

## Breaking Changes for Integrations

1. **`POST /api/incidents`** no longer accepts a full incident object — only intake fields.  
2. **`409 suppressed`** response removed — clients must not expect `AlertSuppressedError`.  
3. **AI extraction** must use the analysis endpoints after intake, not `POST /api/extract` before save.  
4. **Alert evaluation** is no longer synchronous on create.

---

## Deployment Checklist

- [ ] Commit and push changes to GitHub  
- [ ] SSH to EC2 (`ubuntu@18.232.197.149`, path `~/OPSRELAYDashboard`)  
- [ ] Pull latest, `npm install`, `npm run build`  
- [ ] Run `npm run db:migrate` (or restart server to apply versioned migrations)  
- [ ] Set `MCP_ENABLED=true` in production `.env` when ready  
- [ ] Restart API process (`pm2` / systemd)  
- [ ] Verify: save-first intake, approve flow, duplicate banner, MCP query (if enabled)

---

## Related Documents

- **Implementation plan:** `OPSRELAY_SECURITY_AND_MCP_IMPLEMENTATION_PLAN.md`
- **Live app:** http://18.232.197.149/
- **Repository:** https://github.com/RudraYBedekar/OPSRelay.git

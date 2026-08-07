# OpsRelay Demo Flow (5–7 minutes)

Live URL: **http://18.232.197.149/** (HTTPS: run certbot per `docs/EC2_DEPLOY.md` if required)

**Demo account:** `yash` / `OpsRelay2026!` (or register a new account — 5 welcome incidents auto-seed)

**Prep on EC2 (once):**
```bash
npm run db:migrate
npm run db:seed-secure
npm run db:seed-industry-incidents
npm run db:sample-logs
npm run db:embed
```
Ensure `.env`: `BEDROCK_ENABLED=true`, `MCP_MODE=managed_mcp` (or `local_sql_demo` for offline demo)

---

## 1. Open the URL (~30s)

Explain: **OpsRelay is durable incident memory for on-call teams** — structured incidents, vector search, and MCP-approved evidence in CockroachDB, with Bedrock for extraction and reasoning.

---

## 2. Sign in (~30s)

Sign in to the prepared demo account. Point out the **isolated member workspace** — each user sees only their incidents (plus shared grants).

---

## 3. New Incident → AI extract (~45s)

1. Go to **New Incident** → **AI extract** tab
2. Select sample: **`payment-api — Stripe Webhook Failures (DEMO)`**
3. Paste is pre-filled — mention this mirrors a real payment-api webhook outage

---

## 4. Save & analyze (~60s)

Click **Step 2 — Save & analyze**.

**Talking point:** The **incident ID appears immediately** (green banner + toast) *before* Bedrock finishes. Raw notes are persisted in CockroachDB even if the model fails.

---

## 5. Review the Bedrock draft (~60s)

When Step 3 loads, show:
- **Severity, service, summary** (editable)
- **Timeline, decisions, tasks, suggested fixes**
- Edit one harmless word in the summary to show **human control**

---

## 6. Approve → Save only (~45s)

1. Click **Approve & finalize**
2. In the dialog, choose **Save only (don't share)**
3. Open the incident from the dashboard — show the **structured record**

Evidence is projected to `incident_evidence` immediately on approve (MCP-ready).

---

## 7. Refresh the browser (~30s)

Hard refresh, reopen the same incident — prove **CockroachDB persistence** across sessions.

---

## 8. Tasks (~30s)

Open **Tasks**. Move one extracted task from **Open** → **In progress**.

---

## 9. Ask AI — Vector memory (~60s)

1. Open **Ask AI**
2. Mode: **Vector memory**
3. Ask: *"What fixed similar payment-api webhook failures?"*
4. Explain: **Amazon Titan 1,024-dimensional embeddings** stored in CockroachDB; **cosine similarity** surfaces seeded incidents like `INC-IND-003` (payment-api pool saturation)

---

## 10. MCP investigator (~60s)

1. Switch mode to **MCP investigator**
2. **Link your new payment-api incident** from the dropdown
3. Ask: *"Which approved resolutions match this service?"*
4. Show **Managed MCP citation cards** (`approved_summary`, `approved_resolution`)

---

## 11. Generate handoff report (~45s)

On the incident detail page, click **Generate handoff report**.

Show: executive summary, timeline, decisions, tasks, **next steps**, and architecture footer (Bedrock + Vector + MCP).

Copy or download the `.md` file.

---

## 12. Close with architecture (~30s)

Name the three pillars:

| Layer | Technology |
|-------|------------|
| AI extraction & reasoning | **Amazon Bedrock** (Haiku + Nova) on AWS |
| Incident memory & similarity | **CockroachDB Distributed Vector Indexing** |
| Approved evidence queries | **CockroachDB Cloud Managed MCP** (read-only) |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Analysis 503 | Run `npm run db:migrate` |
| MCP 503 | Set `MCP_MODE=managed_mcp` or `local_sql_demo` in `.env`, restart PM2 |
| No vector matches | Run `npm run db:embed` |
| Old sample log title | Run `npm run db:sample-logs` on EC2 |

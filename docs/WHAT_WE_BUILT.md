# OpsRelay — What We Built

Summary of everything completed so far (August 2026).

---

## What It Is

**OpsRelay** is an AI-powered incident-response and shift-handoff dashboard for on-call teams. It stores incidents in CockroachDB, uses AWS Bedrock for AI, and runs on a live EC2 deployment.

**Stack:** React · TypeScript · Tailwind · Express · CockroachDB · AWS Bedrock

**Live:** http://18.232.197.149/  
**GitHub:** https://github.com/RudraYBedekar/OPSRelay.git  
**Test login:** `yash@opsrelay.io` / `OpsRelay2026!`

---

## What We Built

### Platform
- Full-stack dashboard with React frontend and Express API
- CockroachDB for incidents, vectors, alert deduplication, and chat
- Separate **SecureData** database for user credentials
- **Vector search** — incident and alert embeddings in CockroachDB
- **AWS Bedrock** — Haiku for log extraction, Nova for agent, Titan for embeddings
- Deployed to **EC2** with Nginx and PM2

### Login & multi-user
- User registration and login with JWT
- Every user gets a **member ID** (`MEM-XXXXXXXX`)
- Each user sees **only their own incidents** plus ones shared with them
- Share incidents with teammates by member ID
- Access request / approve flow between members
- **Ask AI chat history is private** per user

### Dashboard
- Personalized home page per logged-in user
- Live metrics and handoff summaries from real open incidents
- Incident table with search, filters, and severity/status views
- Incident detail page with timeline, decisions, fixes, and similar incidents

### New incident (intake)
- **Quick add** — short form to create an incident fast
- **AI extract** — paste logs, Bedrock structures severity, timeline, tasks, and decisions
- Optional **share on save** to another member
- Sample logs for demo testing

### Alert Fatigue Agent
Suppresses duplicate / low-signal alerts **before** they become incidents:

- New **`alert_embeddings`** table in CockroachDB (vector + service + suppression counts)
- On new alert: Bedrock Titan embedding → vector search against same-service alerts from last **7 days**
- If similarity **> 85%** and matched alert is **resolved** or **noise** → **suppress** (no new incident)
- Increments `suppressed_count`, updates `last_seen` on the existing alert record
- **Incident detail** shows suppression stats (e.g. “fired 12 times, 11 suppressed”)
- **Manual override** — “Actually distinct” forces a new incident (human-reversible, read-only agent)
- No auto-resolution or auto-escalation — dedupe only

### Ask AI
- Ask questions like “have we seen this before?”
- Searches **CockroachDB vector memory** for similar past incidents
- Bedrock Nova gives recommended next steps
- Chat history saved per user

### Team Chat
- **1:1 messaging** between two team members
- Invite a **third person for 15 or 30 minutes only** (timed guest access)
- Messages stored in CockroachDB

### Task board
- Kanban view of action items across incidents
- Update task status (TODO → In Progress → Done)

### Send to employee
- Sidebar tab to share an existing incident with a teammate by member ID

---

## App tabs (sidebar)

| Tab | What it does |
|-----|----------------|
| Dashboard | Metrics, handoff, incident queue |
| New Incident | Quick add or AI extract |
| Team Chat | Member messaging + timed guests |
| Send to employee | Share incidents by member ID |
| Ask AI | Vector search + agent recommendations |
| Tasks | Task board |

---

## Main databases & tables

**Rudra (operations):** incidents, incident_embeddings, **alert_embeddings**, memory_chats, team chats/messages/guests, sample logs, metrics, handoffs

**SecureData (auth):** users, access requests, access grants, audit log

---

## Timeline of major work

1. Core dashboard, intake, Ask AI, task board, vector search
2. CockroachDB Cloud + Bedrock integration
3. Auth, member IDs, per-user data isolation
4. Live dashboard metrics, sharing, Send to employee
5. Per-user Ask AI history
6. Team Chat with timed guest access
7. **Alert Fatigue Agent** — vector-based alert deduplication
8. EC2 deployment + GitHub repo (OPSRelay)

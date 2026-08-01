import { query, queryOne } from '../db.js';
import { secureQuery } from '../secureDb.js';
import type { AuthUser } from './authService.js';
import {
  searchSimilarIncidents,
  searchIncidentsInCorpus,
  mergeSearchHits,
  type IncidentRecord,
} from './vectorService.js';
import { generateCommanderAnalysis, generateHandoffSummary } from './llmService.js';
import { isBedrockConfigured } from '../config/bedrock.js';

export type CommanderSessionStatus = 'ACTIVE' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
export type ReplayEventType =
  | 'alert'
  | 'ai_decision'
  | 'assignment'
  | 'action'
  | 'failure'
  | 'escalation'
  | 'resolution'
  | 'sla';

export interface ExpertCandidate {
  memberId: string;
  name: string;
  email: string;
  role: string;
  score: number;
  rank: number;
  skills: string[];
  ownedServices: string[];
  availability: 'available' | 'busy' | 'away';
  openTaskCount: number;
  resolvedCount: number;
  serviceMatchCount: number;
  factors: {
    skillMatch: number;
    serviceOwnership: number;
    pastResolutions: number;
    availability: number;
    workload: number;
  };
}

export interface CommanderDecision {
  id: string;
  sessionId: string;
  incidentId: string;
  decisionType: string;
  title: string;
  description: string;
  confidence: number;
  reasoning: Record<string, unknown>;
  createdAt: string;
}

export interface CommanderAssignment {
  id: string;
  sessionId: string;
  incidentId: string;
  memberId: string;
  expertName: string;
  rank: number;
  score: number;
  factors: Record<string, unknown>;
  status: string;
  assignedAt: string;
  respondedAt?: string;
}

export interface CommanderAction {
  id: string;
  sessionId: string;
  incidentId: string;
  actionType: string;
  title: string;
  description?: string;
  actor: string;
  outcome: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReplayEvent {
  id: string;
  sessionId: string;
  incidentId: string;
  eventType: ReplayEventType;
  title: string;
  description?: string;
  actor: string;
  confidence?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CommanderSession {
  id: string;
  incidentId: string;
  status: CommanderSessionStatus;
  slaDeadline: string;
  responseDeadline: string;
  slaBreached: boolean;
  primaryExpertMemberId?: string;
  primaryExpertName?: string;
  escalationLevel: number;
  handoffSummary?: string;
  analysis: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WarRoomState {
  session: CommanderSession;
  incident: Record<string, unknown>;
  decisions: CommanderDecision[];
  assignments: CommanderAssignment[];
  actions: CommanderAction[];
  replay: ReplayEvent[];
  similarIncidents: Array<{
    id: string;
    title: string;
    service: string;
    similarityScore: number;
    keyTakeaway: string;
  }>;
  slaRemainingMs: number;
  responseRemainingMs: number;
  mode: 'bedrock' | 'local';
}

const RESPONSE_SLA_MS = 2 * 60 * 1000;
const SEV0_SLA_MS = 15 * 60 * 1000;
const SEV1_SLA_MS = 30 * 60 * 1000;

function isCriticalSeverity(severity: string): boolean {
  return severity === 'SEV-0' || severity === 'SEV-1';
}

function slaMsForSeverity(severity: string): number {
  return severity === 'SEV-0' ? SEV0_SLA_MS : SEV1_SLA_MS;
}

function sessionIdFor(incidentId: string): string {
  return `cmd-${incidentId}`;
}

function normalizeActionKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function appendReplay(
  sessionId: string,
  incidentId: string,
  event: Omit<ReplayEvent, 'id' | 'sessionId' | 'incidentId' | 'createdAt'>,
): Promise<void> {
  await query(
    `INSERT INTO commander_replay_events (session_id, incident_id, event_type, title, description, actor, confidence, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      sessionId,
      incidentId,
      event.eventType,
      event.title,
      event.description ?? null,
      event.actor,
      event.confidence ?? null,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}

async function appendDecision(
  sessionId: string,
  incidentId: string,
  decision: Omit<CommanderDecision, 'id' | 'sessionId' | 'incidentId' | 'createdAt'>,
): Promise<CommanderDecision> {
  const row = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO commander_decisions (session_id, incident_id, decision_type, title, description, confidence, reasoning)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, created_at`,
    [
      sessionId,
      incidentId,
      decision.decisionType,
      decision.title,
      decision.description,
      decision.confidence,
      JSON.stringify(decision.reasoning),
    ],
  );
  return {
    ...decision,
    id: row!.id,
    sessionId,
    incidentId,
    createdAt: row!.created_at,
  };
}

async function loadIncident(incidentId: string): Promise<Record<string, unknown> | null> {
  const row = await queryOne<{ data: Record<string, unknown> }>(
    'SELECT data FROM incidents WHERE id = $1',
    [incidentId],
  );
  return row?.data ?? null;
}

async function saveIncident(incident: Record<string, unknown>): Promise<void> {
  await query(
    'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
    [incident.id, JSON.stringify(incident)],
  );
}

async function getAllIncidents(): Promise<Array<IncidentRecord & Record<string, unknown>>> {
  const rows = await query<{ data: IncidentRecord & Record<string, unknown> }>('SELECT data FROM incidents');
  return rows.map((r) => r.data);
}

async function rankExperts(
  incident: Record<string, unknown>,
  similarIncidents: WarRoomState['similarIncidents'],
): Promise<ExpertCandidate[]> {
  const users = await secureQuery<{
    member_id: string;
    name: string;
    email: string;
    role: string;
    last_login_at: string | null;
  }>('SELECT member_id, name, email, role, last_login_at FROM users ORDER BY name');

  const allIncidents = await getAllIncidents();
  const service = String(incident.service ?? '');
  const summaryLower = `${incident.summary ?? ''} ${incident.component ?? ''}`.toLowerCase();

  const skillKeywords = ['cockroach', 'kubernetes', 'aws', 'redis', 'kafka', 'postgres', 'node', 'bedrock'];
  const relevantSkills = skillKeywords.filter((k) => summaryLower.includes(k));

  const candidates: ExpertCandidate[] = users.map((user) => {
    const ownedServices = new Set<string>();
    let resolvedCount = 0;
    let serviceMatchCount = 0;
    let openTaskCount = 0;

    for (const inc of allIncidents) {
      const incService = String(inc.service ?? '');
      const isOwner =
        String(inc.ownerMemberId ?? '') === user.member_id ||
        String(inc.leadSRE ?? '').toLowerCase() === user.name.toLowerCase();

      if (isOwner || incService === service) {
        ownedServices.add(incService);
      }

      if (String(inc.status ?? '') === 'RESOLVED' && (isOwner || incService === service)) {
        resolvedCount += 1;
      }

      if (incService === service) serviceMatchCount += 1;

      const incTasks = Array.isArray(inc.tasks) ? inc.tasks as Array<{ assignee?: string; status?: string }> : [];
      for (const task of incTasks) {
        if (
          task.assignee?.toLowerCase().includes(user.name.toLowerCase()) &&
          task.status !== 'COMPLETED'
        ) {
          openTaskCount += 1;
        }
      }
    }

    const skills = relevantSkills.length > 0
      ? relevantSkills.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      : ownedServices.size > 0
        ? [...ownedServices].slice(0, 3)
        : ['General SRE'];

    const skillMatch = relevantSkills.length > 0
      ? Math.min(100, 40 + relevantSkills.length * 15)
      : 50;

    const serviceOwnership = serviceMatchCount > 0
      ? Math.min(100, 50 + serviceMatchCount * 10)
      : ownedServices.has(service) ? 80 : 30;

    const pastResolutions = Math.min(100, resolvedCount * 12);

    const lastLogin = user.last_login_at ? new Date(user.last_login_at).getTime() : 0;
    const hoursSinceLogin = lastLogin ? (Date.now() - lastLogin) / 3600000 : 999;
    const availabilityScore = hoursSinceLogin < 24 ? 95 : hoursSinceLogin < 72 ? 70 : 40;
    const availability: ExpertCandidate['availability'] =
      hoursSinceLogin < 24 ? 'available' : hoursSinceLogin < 72 ? 'busy' : 'away';

    const workload = Math.max(0, 100 - openTaskCount * 15);

    const similarBonus = similarIncidents.some((s) =>
      allIncidents.find((i) => i.id === s.id && (
        String(i.ownerMemberId ?? '') === user.member_id ||
        String(i.leadSRE ?? '').toLowerCase() === user.name.toLowerCase()
      )),
    ) ? 15 : 0;

    const adminBonus = user.role === 'admin' ? 10 : 0;

    const score = Math.min(100, Math.round(
      skillMatch * 0.2 +
      serviceOwnership * 0.25 +
      pastResolutions * 0.2 +
      availabilityScore * 0.15 +
      workload * 0.1 +
      similarBonus +
      adminBonus,
    ));

    return {
      memberId: user.member_id,
      name: user.name,
      email: user.email,
      role: user.role,
      score,
      rank: 0,
      skills,
      ownedServices: [...ownedServices],
      availability,
      openTaskCount,
      resolvedCount,
      serviceMatchCount,
      factors: {
        skillMatch,
        serviceOwnership,
        pastResolutions,
        availability: availabilityScore,
        workload,
      },
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates.map((c, i) => ({ ...c, rank: i + 1 }));
}

async function findSimilarIncidents(incident: Record<string, unknown>): Promise<WarRoomState['similarIncidents']> {
  const queryText = `${incident.title} ${incident.summary} ${incident.service} ${incident.component}`;
  const allIncidents = await getAllIncidents();
  const corpusHits = searchIncidentsInCorpus(queryText, allIncidents, 8);

  let hits = corpusHits;
  try {
    const vectorHits = await searchSimilarIncidents(queryText, 8, String(incident.service ?? undefined));
    hits = mergeSearchHits(corpusHits, vectorHits).slice(0, 5);
  } catch {
    hits = corpusHits.slice(0, 5);
  }

  return hits
    .filter((h) => h.incidentId !== incident.id)
    .map((hit) => {
      const inc = allIncidents.find((i) => i.id === hit.incidentId);
      return {
        id: hit.incidentId,
        title: inc?.title ?? hit.incidentId,
        service: hit.service,
        similarityScore: hit.similarityScore,
        keyTakeaway: inc?.fixesApplied?.[0] ?? inc?.summary?.slice(0, 120) ?? hit.content.slice(0, 120),
      };
    });
}

function buildInvestigationTasks(
  incident: Record<string, unknown>,
  analysis: Awaited<ReturnType<typeof generateCommanderAnalysis>>,
  primaryExpert: ExpertCandidate,
): Array<Record<string, unknown>> {
  const now = new Date().toISOString();
  const severity = String(incident.severity ?? 'SEV-1');
  const priorityMap: Record<string, string> = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
  };

  return analysis.investigationTasks.map((task, idx) => ({
    id: `tsk-${incident.id}-cmd-${idx + 1}`,
    incidentId: incident.id,
    incidentTitle: incident.title,
    title: task.title,
    assignee: idx === 0 ? primaryExpert.name : 'Unassigned (Ops Team)',
    status: 'TODO',
    priority: priorityMap[task.priority] ?? 'HIGH',
    severity,
    createdAt: now,
  }));
}

export async function launchCommander(
  incidentId: string,
  triggeredBy?: AuthUser,
): Promise<WarRoomState> {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM commander_sessions WHERE incident_id = $1',
    [incidentId],
  );
  if (existing) {
    return getWarRoom(incidentId);
  }

  const incident = await loadIncident(incidentId);
  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  const severity = String(incident.severity ?? 'SEV-2');
  if (!isCriticalSeverity(severity)) {
    throw new Error('Incident Commander only activates for SEV-0 and SEV-1 incidents');
  }

  const sessionId = sessionIdFor(incidentId);
  const now = Date.now();
  const slaDeadline = new Date(now + slaMsForSeverity(severity)).toISOString();
  const responseDeadline = new Date(now + RESPONSE_SLA_MS).toISOString();

  const similarIncidents = await findSimilarIncidents(incident);
  const experts = await rankExperts(incident, similarIncidents);
  const topThree = experts.slice(0, 3);
  const primary = topThree[0];

  if (!primary) {
    throw new Error('No experts available for assignment');
  }

  const analysis = await generateCommanderAnalysis({
    incident,
    similarIncidents,
    expertCandidates: topThree.map((e) => ({
      name: e.name,
      memberId: e.memberId,
      score: e.score,
      skills: e.skills,
      factors: e.factors,
    })),
  });

  await query(
    `INSERT INTO commander_sessions
     (id, incident_id, status, sla_deadline, response_deadline, primary_expert_member_id, primary_expert_name, analysis)
     VALUES ($1, $2, 'ACTIVE', $3::timestamptz, $4::timestamptz, $5, $6, $7::jsonb)`,
    [
      sessionId,
      incidentId,
      slaDeadline,
      responseDeadline,
      primary.memberId,
      primary.name,
      JSON.stringify({
        ...analysis,
        technologies: analysis.technologies,
        affectedServices: analysis.affectedServices,
        similarIncidents,
        triggeredBy: triggeredBy?.memberId ?? 'system',
        mode: isBedrockConfigured() ? 'bedrock' : 'local',
      }),
    ],
  );

  await appendReplay(sessionId, incidentId, {
    eventType: 'alert',
    title: `Critical alert: ${incident.title}`,
    description: String(incident.summary ?? ''),
    actor: 'System Monitor',
    metadata: { severity },
  });

  const analysisDecision = await appendDecision(sessionId, incidentId, {
    decisionType: 'analysis',
    title: 'Incident analysis complete',
    description: analysis.impactAssessment,
    confidence: analysis.confidenceScore,
    reasoning: {
      similarIncidents,
      technologies: analysis.technologies,
      affectedServices: analysis.affectedServices,
      recommendedActions: analysis.recommendedActions,
      summary: analysis.reasoningSummary,
    },
  });

  await appendReplay(sessionId, incidentId, {
    eventType: 'ai_decision',
    title: analysisDecision.title,
    description: analysisDecision.description,
    actor: 'OpsRelay Commander',
    confidence: analysisDecision.confidence,
    metadata: analysisDecision.reasoning,
  });

  for (const expert of topThree) {
    await query(
      `INSERT INTO commander_assignments
       (session_id, incident_id, member_id, expert_name, rank, score, factors, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        sessionId,
        incidentId,
        expert.memberId,
        expert.name,
        expert.rank,
        expert.score,
        JSON.stringify({ ...expert.factors, skills: expert.skills, availability: expert.availability }),
        expert.rank === 1 ? 'PENDING' : 'STANDBY',
      ],
    );
  }

  const expertDecision = await appendDecision(sessionId, incidentId, {
    decisionType: 'expert_selection',
    title: `Primary expert: ${primary.name}`,
    description: `Selected ${primary.name} (${primary.memberId}) with ${primary.score}/100 match score. Alternates: ${topThree.slice(1).map((e) => e.name).join(', ') || 'none'}.`,
    confidence: primary.score,
    reasoning: {
      primaryExpert: primary,
      alternates: topThree.slice(1),
      factors: primary.factors,
    },
  });

  await appendReplay(sessionId, incidentId, {
    eventType: 'assignment',
    title: `Assigned ${primary.name} as primary responder`,
    description: expertDecision.description,
    actor: 'OpsRelay Commander',
    confidence: primary.score,
    metadata: { memberId: primary.memberId, rank: 1 },
  });

  await appendReplay(sessionId, incidentId, {
    eventType: 'sla',
    title: 'SLA timers started',
    description: `Resolution SLA: ${severity === 'SEV-0' ? '15' : '30'} min. Response SLA: 2 min.`,
    actor: 'OpsRelay Commander',
    metadata: { slaDeadline, responseDeadline },
  });

  const cmdTasks = buildInvestigationTasks(incident, analysis, primary);
  const existingTasks = Array.isArray(incident.tasks) ? incident.tasks : [];
  incident.tasks = [...existingTasks, ...cmdTasks];
  incident.status = 'INVESTIGATING';
  incident.leadSRE = primary.name;

  const timeline = Array.isArray(incident.timeline) ? incident.timeline : [];
  const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  timeline.unshift(
    {
      id: `tl-${Date.now()}-cmd`,
      timestamp: timeLabel,
      title: 'Incident Commander activated',
      description: analysis.impactAssessment,
      actor: 'OpsRelay AI',
      type: 'decision',
    },
    {
      id: `tl-${Date.now()}-assign`,
      timestamp: timeLabel,
      title: `Expert assigned: ${primary.name}`,
      description: expertDecision.description,
      actor: 'OpsRelay AI',
      type: 'action',
    },
  );
  incident.timeline = timeline;

  const decisions = Array.isArray(incident.decisions) ? incident.decisions : [];
  decisions.unshift({
    id: `dec-${Date.now()}`,
    title: expertDecision.title,
    description: expertDecision.description,
    madeBy: 'OpsRelay Commander',
    timestamp: timeLabel,
    impact: 'Accelerated triage and ownership assignment',
  });
  incident.decisions = decisions;

  if (similarIncidents.length > 0) {
    incident.similarIncidents = similarIncidents.map((s) => ({
      id: s.id,
      title: s.title,
      similarityScore: s.similarityScore,
      service: s.service,
      resolvedDuration: '—',
      keyTakeaway: s.keyTakeaway,
      citations: [],
      severity: 'SEV-1' as const,
      resolvedDate: '—',
    }));
  }

  await saveIncident(incident);

  const taskDecision = await appendDecision(sessionId, incidentId, {
    decisionType: 'task_creation',
    title: `${cmdTasks.length} investigation tasks created`,
    description: cmdTasks.map((t) => t.title).join('; '),
    confidence: analysis.confidenceScore,
    reasoning: { tasks: cmdTasks },
  });

  await appendReplay(sessionId, incidentId, {
    eventType: 'ai_decision',
    title: taskDecision.title,
    description: taskDecision.description,
    actor: 'OpsRelay Commander',
    confidence: taskDecision.confidence,
    metadata: { taskIds: cmdTasks.map((t) => t.id) },
  });

  for (const action of analysis.recommendedActions.slice(0, 3)) {
    await query(
      `INSERT INTO commander_actions (session_id, incident_id, action_type, title, description, actor, outcome, metadata)
       VALUES ($1, $2, 'recommendation', $3, $4, 'OpsRelay Commander', 'pending', $5::jsonb)`,
      [sessionId, incidentId, action, action, JSON.stringify({ confidence: analysis.confidenceScore })],
    );

    await appendReplay(sessionId, incidentId, {
      eventType: 'action',
      title: `Recommended: ${action}`,
      description: action,
      actor: 'OpsRelay Commander',
      confidence: analysis.confidenceScore,
      metadata: {},
    });
  }

  return getWarRoom(incidentId);
}

export async function getWarRoom(incidentId: string): Promise<WarRoomState> {
  await checkAndEscalate(incidentId);

  const sessionRow = await queryOne<{
    id: string;
    incident_id: string;
    status: string;
    sla_deadline: string;
    response_deadline: string;
    sla_breached: boolean;
    primary_expert_member_id: string | null;
    primary_expert_name: string | null;
    escalation_level: number;
    handoff_summary: string | null;
    analysis: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM commander_sessions WHERE incident_id = $1', [incidentId]);

  if (!sessionRow) throw new Error(`No commander session for ${incidentId}`);

  const incident = await loadIncident(incidentId);
  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  const [decisions, assignments, actions, replay] = await Promise.all([
    query<{
      id: string; session_id: string; incident_id: string; decision_type: string;
      title: string; description: string; confidence: number; reasoning: Record<string, unknown>; created_at: string;
    }>('SELECT * FROM commander_decisions WHERE incident_id = $1 ORDER BY created_at', [incidentId]),
    query<{
      id: string; session_id: string; incident_id: string; member_id: string; expert_name: string;
      rank: number; score: number; factors: Record<string, unknown>; status: string;
      assigned_at: string; responded_at: string | null;
    }>('SELECT * FROM commander_assignments WHERE incident_id = $1 ORDER BY rank', [incidentId]),
    query<{
      id: string; session_id: string; incident_id: string; action_type: string;
      title: string; description: string | null; actor: string; outcome: string;
      metadata: Record<string, unknown>; created_at: string;
    }>('SELECT * FROM commander_actions WHERE incident_id = $1 ORDER BY created_at', [incidentId]),
    query<{
      id: string; session_id: string; incident_id: string; event_type: string;
      title: string; description: string | null; actor: string; confidence: number | null;
      metadata: Record<string, unknown>; created_at: string;
    }>('SELECT * FROM commander_replay_events WHERE incident_id = $1 ORDER BY created_at', [incidentId]),
  ]);

  const analysis = sessionRow.analysis ?? {};
  const similarFromAnalysis = (analysis as { similarIncidents?: WarRoomState['similarIncidents'] }).similarIncidents;
  const similarIncidents = similarFromAnalysis ?? await findSimilarIncidents(incident);

  const now = Date.now();
  const slaRemainingMs = Math.max(0, new Date(sessionRow.sla_deadline).getTime() - now);
  const responseRemainingMs = Math.max(0, new Date(sessionRow.response_deadline).getTime() - now);

  if (slaRemainingMs === 0 && !sessionRow.sla_breached) {
    await query(
      'UPDATE commander_sessions SET sla_breached = true, updated_at = now() WHERE id = $1',
      [sessionRow.id],
    );
  }

  return {
    session: {
      id: sessionRow.id,
      incidentId: sessionRow.incident_id,
      status: sessionRow.status as CommanderSessionStatus,
      slaDeadline: sessionRow.sla_deadline,
      responseDeadline: sessionRow.response_deadline,
      slaBreached: sessionRow.sla_breached || slaRemainingMs === 0,
      primaryExpertMemberId: sessionRow.primary_expert_member_id ?? undefined,
      primaryExpertName: sessionRow.primary_expert_name ?? undefined,
      escalationLevel: sessionRow.escalation_level,
      handoffSummary: sessionRow.handoff_summary ?? undefined,
      analysis: sessionRow.analysis,
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at,
    },
    incident,
    decisions: decisions.map((d) => ({
      id: d.id,
      sessionId: d.session_id,
      incidentId: d.incident_id,
      decisionType: d.decision_type,
      title: d.title,
      description: d.description,
      confidence: d.confidence,
      reasoning: d.reasoning,
      createdAt: d.created_at,
    })),
    assignments: assignments.map((a) => ({
      id: a.id,
      sessionId: a.session_id,
      incidentId: a.incident_id,
      memberId: a.member_id,
      expertName: a.expert_name,
      rank: a.rank,
      score: a.score,
      factors: a.factors,
      status: a.status,
      assignedAt: a.assigned_at,
      respondedAt: a.responded_at ?? undefined,
    })),
    actions: actions.map((a) => ({
      id: a.id,
      sessionId: a.session_id,
      incidentId: a.incident_id,
      actionType: a.action_type,
      title: a.title,
      description: a.description ?? undefined,
      actor: a.actor,
      outcome: a.outcome,
      metadata: a.metadata,
      createdAt: a.created_at,
    })),
    replay: replay.map((e) => ({
      id: e.id,
      sessionId: e.session_id,
      incidentId: e.incident_id,
      eventType: e.event_type as ReplayEventType,
      title: e.title,
      description: e.description ?? undefined,
      actor: e.actor,
      confidence: e.confidence ?? undefined,
      metadata: e.metadata,
      createdAt: e.created_at,
    })),
    similarIncidents,
    slaRemainingMs,
    responseRemainingMs,
    mode: (analysis.mode as 'bedrock' | 'local') ?? (isBedrockConfigured() ? 'bedrock' : 'local'),
  };
}

export async function listActiveWarRooms(): Promise<Array<{ incidentId: string; session: CommanderSession; incidentTitle: string; severity: string }>> {
  const rows = await query<{
    id: string;
    incident_id: string;
    status: string;
    sla_deadline: string;
    response_deadline: string;
    sla_breached: boolean;
    primary_expert_member_id: string | null;
    primary_expert_name: string | null;
    escalation_level: number;
    handoff_summary: string | null;
    analysis: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM commander_sessions WHERE status IN ('ACTIVE', 'ESCALATED') ORDER BY updated_at DESC`,
  );

  const results = [];
  for (const row of rows) {
    const incident = await loadIncident(row.incident_id);
    results.push({
      incidentId: row.incident_id,
      session: {
        id: row.id,
        incidentId: row.incident_id,
        status: row.status as CommanderSessionStatus,
        slaDeadline: row.sla_deadline,
        responseDeadline: row.response_deadline,
        slaBreached: row.sla_breached,
        primaryExpertMemberId: row.primary_expert_member_id ?? undefined,
        primaryExpertName: row.primary_expert_name ?? undefined,
        escalationLevel: row.escalation_level,
        handoffSummary: row.handoff_summary ?? undefined,
        analysis: row.analysis,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      incidentTitle: String(incident?.title ?? row.incident_id),
      severity: String(incident?.severity ?? 'SEV-1'),
    });
  }
  return results;
}

export async function checkAndEscalate(incidentId: string): Promise<boolean> {
  const sessionRow = await queryOne<{
    id: string;
    status: string;
    response_deadline: string;
    escalation_level: number;
    primary_expert_member_id: string | null;
    primary_expert_name: string | null;
  }>('SELECT * FROM commander_sessions WHERE incident_id = $1', [incidentId]);

  if (!sessionRow || sessionRow.status === 'RESOLVED' || sessionRow.status === 'CLOSED') {
    return false;
  }

  const primaryAssignment = await queryOne<{
    id: string;
    status: string;
    member_id: string;
    expert_name: string;
    assigned_at: string;
  }>(
    `SELECT id, status, member_id, expert_name, assigned_at FROM commander_assignments
     WHERE incident_id = $1 AND rank = 1 ORDER BY assigned_at DESC LIMIT 1`,
    [incidentId],
  );

  if (!primaryAssignment || primaryAssignment.status === 'ACCEPTED') {
    return false;
  }

  const responseDeadline = new Date(sessionRow.response_deadline).getTime();
  if (Date.now() < responseDeadline) {
    return false;
  }

  const nextExpert = await queryOne<{
    id: string;
    member_id: string;
    expert_name: string;
    score: number;
    rank: number;
  }>(
    `SELECT id, member_id, expert_name, score, rank FROM commander_assignments
     WHERE incident_id = $1 AND status = 'STANDBY' ORDER BY rank LIMIT 1`,
    [incidentId],
  );

  let newExpert = nextExpert;
  if (!newExpert) {
    const lead = await secureQuery<{ member_id: string; name: string; role: string }>(
      `SELECT member_id, name, role FROM users WHERE role = 'admin' ORDER BY name LIMIT 1`,
    );
    if (lead[0]) {
      newExpert = {
        id: '',
        member_id: lead[0].member_id,
        expert_name: lead[0].name,
        score: 90,
        rank: 99,
      };
    }
  }

  if (!newExpert) return false;

  await query(
    `UPDATE commander_assignments SET status = 'ESCALATED', responded_at = now() WHERE id = $1`,
    [primaryAssignment.id],
  );

  if (newExpert.id) {
    await query(
      `UPDATE commander_assignments SET status = 'PENDING' WHERE id = $1`,
      [newExpert.id],
    );
  }

  const newLevel = sessionRow.escalation_level + 1;
  await query(
    `UPDATE commander_sessions SET
       status = 'ESCALATED',
       escalation_level = $2,
       primary_expert_member_id = $3,
       primary_expert_name = $4,
       response_deadline = $5::timestamptz,
       updated_at = now()
     WHERE id = $1`,
    [
      sessionRow.id,
      newLevel,
      newExpert.member_id,
      newExpert.expert_name,
      new Date(Date.now() + RESPONSE_SLA_MS).toISOString(),
    ],
  );

  const incident = await loadIncident(incidentId);
  if (incident) {
    incident.leadSRE = newExpert.expert_name;
    await saveIncident(incident);
  }

  const escalationDecision = await appendDecision(sessionRow.id, incidentId, {
    decisionType: 'escalation',
    title: `Escalated to ${newExpert.expert_name}`,
    description: `No response from ${primaryAssignment.expert_name} within 2-minute SLA. Escalation level ${newLevel}.`,
    confidence: newExpert.score,
    reasoning: {
      previousExpert: primaryAssignment.expert_name,
      newExpert: newExpert.expert_name,
      escalationLevel: newLevel,
    },
  });

  await appendReplay(sessionRow.id, incidentId, {
    eventType: 'escalation',
    title: escalationDecision.title,
    description: escalationDecision.description,
    actor: 'OpsRelay Commander',
    confidence: escalationDecision.confidence,
    metadata: escalationDecision.reasoning,
  });

  return true;
}

export async function recordUserAction(
  incidentId: string,
  input: { title: string; description?: string; actor: string; outcome?: string },
): Promise<{ action: CommanderAction; warning?: string }> {
  const sessionRow = await queryOne<{ id: string }>(
    'SELECT id FROM commander_sessions WHERE incident_id = $1',
    [incidentId],
  );
  if (!sessionRow) throw new Error(`No commander session for ${incidentId}`);

  const actionKey = normalizeActionKey(input.title);
  const priorFailed = await query<{ title: string; created_at: string; incident_id: string }>(
    `SELECT title, created_at, incident_id FROM commander_actions
     WHERE outcome = 'failed' AND lower(title) LIKE $1
     ORDER BY created_at DESC LIMIT 5`,
    [`%${actionKey.slice(0, 20)}%`],
  );

  let outcome = input.outcome ?? 'pending';
  let warning: string | undefined;

  if (priorFailed.length > 0 && outcome !== 'success') {
    const match = priorFailed[0];
    warning = `This action resembles a previously failed step ("${match.title}" on ${match.incident_id}). Consider an alternate approach.`;
    outcome = 'repeated';

    await appendReplay(sessionRow.id, incidentId, {
      eventType: 'failure',
      title: 'Repeated ineffective action detected',
      description: warning,
      actor: 'OpsRelay Commander',
      confidence: 88,
      metadata: { priorAction: match.title, priorIncident: match.incident_id },
    });

    await appendDecision(sessionRow.id, incidentId, {
      decisionType: 'warning',
      title: 'Duplicate troubleshooting detected',
      description: warning,
      confidence: 88,
      reasoning: { priorFailed, attemptedAction: input.title },
    });
  }

  const row = await queryOne<{
    id: string; created_at: string;
  }>(
    `INSERT INTO commander_actions (session_id, incident_id, action_type, title, description, actor, outcome, metadata)
     VALUES ($1, $2, 'user_action', $3, $4, $5, $6, '{}'::jsonb)
     RETURNING id, created_at`,
    [sessionRow.id, incidentId, input.title, input.description ?? null, input.actor, outcome],
  );

  await appendReplay(sessionRow.id, incidentId, {
    eventType: outcome === 'repeated' ? 'failure' : 'action',
    title: input.title,
    description: input.description ?? input.title,
    actor: input.actor,
    metadata: { outcome },
  });

  return {
    action: {
      id: row!.id,
      sessionId: sessionRow.id,
      incidentId,
      actionType: 'user_action',
      title: input.title,
      description: input.description,
      actor: input.actor,
      outcome,
      metadata: {},
      createdAt: row!.created_at,
    },
    warning,
  };
}

export async function acknowledgeAssignment(
  incidentId: string,
  memberId: string,
): Promise<void> {
  await query(
    `UPDATE commander_assignments SET status = 'ACCEPTED', responded_at = now()
     WHERE incident_id = $1 AND member_id = $2 AND status = 'PENDING'`,
    [incidentId, memberId],
  );

  const sessionRow = await queryOne<{ id: string }>(
    'SELECT id FROM commander_sessions WHERE incident_id = $1',
    [incidentId],
  );
  if (!sessionRow) return;

  await appendReplay(sessionRow.id, incidentId, {
    eventType: 'action',
    title: 'Expert acknowledged assignment',
    description: `Member ${memberId} accepted the incident assignment.`,
    actor: memberId,
    metadata: {},
  });
}

export async function resolveCommander(incidentId: string): Promise<WarRoomState> {
  const warRoom = await getWarRoom(incidentId);

  const handoffSummary = await generateHandoffSummary({
    incident: warRoom.incident,
    replayEvents: warRoom.replay.map((e) => ({
      title: e.title,
      description: e.description,
      eventType: e.eventType,
    })),
    decisions: warRoom.decisions.map((d) => ({ title: d.title, confidence: d.confidence })),
    primaryExpert: warRoom.session.primaryExpertName,
  });

  await query(
    `UPDATE commander_sessions SET status = 'RESOLVED', handoff_summary = $2, updated_at = now() WHERE incident_id = $1`,
    [incidentId, handoffSummary],
  );

  const incident = await loadIncident(incidentId);
  if (incident) {
    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date().toISOString();
    const created = new Date(String(incident.createdAt)).getTime();
    incident.mttrMinutes = Math.round((Date.now() - created) / 60000) || 1;

    const timeline = Array.isArray(incident.timeline) ? incident.timeline : [];
    timeline.unshift({
      id: `tl-${Date.now()}-resolve`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: 'Incident resolved — handoff generated',
      description: handoffSummary.slice(0, 300),
      actor: 'OpsRelay Commander',
      type: 'fix',
    });
    incident.timeline = timeline;
    await saveIncident(incident);
  }

  await appendReplay(warRoom.session.id, incidentId, {
    eventType: 'resolution',
    title: 'Incident resolved',
    description: handoffSummary.slice(0, 500),
    actor: 'OpsRelay Commander',
    metadata: { handoffSummary },
  });

  return getWarRoom(incidentId);
}

export async function getReplay(incidentId: string): Promise<ReplayEvent[]> {
  const warRoom = await getWarRoom(incidentId);
  return warRoom.replay;
}

export function shouldAutoLaunchCommander(severity: string): boolean {
  return isCriticalSeverity(severity);
}

export async function triggerCommanderIfCritical(
  incident: { id: string; severity: string },
  triggeredBy?: AuthUser,
): Promise<void> {
  if (!shouldAutoLaunchCommander(incident.severity)) return;

  try {
    await launchCommander(incident.id, triggeredBy);
    console.log(`Incident Commander launched for ${incident.id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('already')) {
      console.warn(`Commander auto-launch failed for ${incident.id}:`, msg);
    }
  }
}

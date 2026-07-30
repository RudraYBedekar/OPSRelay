import type {
  Incident,
  ActionItemTask,
  ShiftHandoff,
  DashboardMetrics,
  ExtractionResult,
  MemoryChatMessage,
  TaskStatus,
  IncidentStatus,
  Severity
} from '../types/incident';
import {
  INITIAL_METRICS,
  INITIAL_HANDOFF,
  SAMPLE_INCIDENTS,
  INITIAL_MEMORY_CHATS
} from '../data/mockData';
import { crdbClient } from './crdbClient';
import { buildExecutiveSummary } from '../utils/summaryFormat';
import { buildDefaultTask, parseDefaultTaskIncidentId } from '../utils/incidentTasks';

const USE_CRDB = import.meta.env.VITE_USE_CRDB === 'true';

const STORAGE_KEYS = {
  INCIDENTS: 'opsrelay_incidents',
  HANDOFF: 'opsrelay_handoff',
  METRICS: 'opsrelay_metrics',
  CHATS: 'opsrelay_chats',
  SIMULATE_ERROR: 'opsrelay_simulate_error'
};

class ApiService {
  private isErrorSimulated: boolean = false;

  constructor() {
    if (!USE_CRDB) {
      this.initStorage();
    }
  }

  private initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.INCIDENTS)) {
      localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(SAMPLE_INCIDENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.HANDOFF)) {
      localStorage.setItem(STORAGE_KEYS.HANDOFF, JSON.stringify(INITIAL_HANDOFF));
    }
    if (!localStorage.getItem(STORAGE_KEYS.METRICS)) {
      localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(INITIAL_METRICS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CHATS)) {
      localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(INITIAL_MEMORY_CHATS));
    }
  }

  public setSimulateError(simulate: boolean) {
    this.isErrorSimulated = simulate;
  }

  public getSimulateError(): boolean {
    return this.isErrorSimulated;
  }

  private async checkError() {
    if (this.isErrorSimulated) {
      await new Promise(res => setTimeout(res, 600));
      throw new Error('OpsRelay API Gateway Error (503): Vector Store Connection Interrupted');
    }
  }

  // Fetch telemetry dashboard metrics
  public async getMetrics(): Promise<DashboardMetrics> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.getMetrics();
    await new Promise(res => setTimeout(res, 200));
    const data = localStorage.getItem(STORAGE_KEYS.METRICS);
    return data ? JSON.parse(data) : INITIAL_METRICS;
  }

  // Fetch current shift handoff state
  public async getShiftHandoff(): Promise<ShiftHandoff> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.getShiftHandoff();
    await new Promise(res => setTimeout(res, 250));
    const data = localStorage.getItem(STORAGE_KEYS.HANDOFF);
    return data ? JSON.parse(data) : INITIAL_HANDOFF;
  }

  // Acknowledge incoming shift handoff
  public async acknowledgeShiftHandoff(_shiftId: string): Promise<ShiftHandoff> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.acknowledgeShiftHandoff();
    const handoff = await this.getShiftHandoff();
    handoff.handshakeStatus = 'ACKNOWLEDGED';
    localStorage.setItem(STORAGE_KEYS.HANDOFF, JSON.stringify(handoff));
    return handoff;
  }

  // Fetch all incidents
  public async getIncidents(): Promise<Incident[]> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.getIncidents();
    await new Promise(res => setTimeout(res, 300));
    const data = localStorage.getItem(STORAGE_KEYS.INCIDENTS);
    return data ? JSON.parse(data) : SAMPLE_INCIDENTS;
  }

  // Get single incident by ID
  public async getIncidentById(id: string): Promise<Incident | null> {
    await this.checkError();
    if (USE_CRDB) {
      try {
        return await crdbClient.getIncidentById(id);
      } catch {
        return null;
      }
    }
    const incidents = await this.getIncidents();
    return incidents.find(inc => inc.id === id) || null;
  }

  // Save or update an incident
  public async saveIncident(incident: Incident, shareWithMemberId?: string): Promise<Incident> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.saveIncident(incident, shareWithMemberId);
    const toSave = shareWithMemberId
      ? {
          ...incident,
          sharedWithMemberIds: [...new Set([...(incident.sharedWithMemberIds ?? []), shareWithMemberId.toUpperCase()])],
        }
      : incident;
    const incidents = await this.getIncidents();
    const existingIdx = incidents.findIndex(i => i.id === incident.id);

    if (existingIdx >= 0) {
      incidents[existingIdx] = toSave;
    } else {
      incidents.unshift(toSave);
    }

    localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
    return toSave;
  }

  // Update incident status
  public async updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.updateIncidentStatus(id, status);
    const incident = await this.getIncidentById(id);
    if (!incident) throw new Error(`Incident ${id} not found`);

    incident.status = status;
    if (status === 'RESOLVED' && !incident.resolvedAt) {
      incident.resolvedAt = new Date().toISOString();
      const durationMs = new Date().getTime() - new Date(incident.createdAt).getTime();
      incident.mttrMinutes = Math.round(durationMs / (1000 * 60)) || 25;
    }

    await this.saveIncident(incident);
    return incident;
  }

  // Extract structured incident data from raw notes via AI
  public async extractIncidentFromNotes(rawNotes: string): Promise<ExtractionResult> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.extractIncidentFromNotes(rawNotes);
    await new Promise(res => setTimeout(res, 1800));

    const lower = rawNotes.toLowerCase();

    let severity: Severity = 'SEV-2';
    let severityReason = 'Moderate service degradation observed; full user impact has not been confirmed.';
    if (lower.includes('oom') || lower.includes('crashloop') || lower.includes('sev-0') || lower.includes('down') || lower.includes('outage')) {
      severity = 'SEV-0';
      severityReason = 'Critical outage indicators detected (service down, crash loop, or explicit SEV-0 classification).';
    } else if (lower.includes('pgbouncer') || lower.includes('exhausted') || lower.includes('500') || lower.includes('sev-1') || lower.includes('db')) {
      severity = 'SEV-1';
      severityReason = 'Major degradation indicated by elevated error rates or database connection exhaustion.';
    } else if (lower.includes('minor') || lower.includes('slow') || lower.includes('warning')) {
      severity = 'SEV-3';
      severityReason = 'Low-severity warning signals with limited expected user impact.';
    }

    let service = 'billing-service';
    let component = 'pgbouncer-pool';
    if (lower.includes('auth') || lower.includes('jwt') || lower.includes('token')) {
      service = 'auth-service';
      component = 'k8s-pod-memory';
    } else if (lower.includes('stripe') || lower.includes('payment') || lower.includes('webhook')) {
      service = 'payment-gateway';
      component = 'stripe-listener';
    } else if (lower.includes('redis') || lower.includes('cache')) {
      service = 'cache-cluster';
      component = 'redis-sentinel';
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return {
      severity,
      severityReason,
      service,
      component,
      summary: buildExecutiveSummary({ service, component, severity, rawNotes }),
      confidenceScore: Math.floor(Math.random() * 6) + 94,
      timeline: [
        {
          timestamp: timeStr,
          title: 'Unstructured Log Input Received',
          description: 'OpsRelay AI parsed incident dump and Slack conversation telemetry.',
          actor: 'OpsRelay AI',
          type: 'detection'
        },
        {
          timestamp: timeStr,
          title: 'Root Cause & Anomaly Identified',
          description: `Extracted anomalous telemetry spike in ${service} (${component}).`,
          actor: 'OpsRelay AI',
          type: 'alert'
        }
      ],
      decisions: [
        {
          title: `Apply emergency tuning on ${component}`,
          description: `Temporary parameter patch on ${service} to stabilize error response rates.`,
          madeBy: 'OpsRelay AI Recommendation',
          timestamp: timeStr,
          impact: 'Mitigates cascaded connection starvation across adjacent clusters.'
        }
      ],
      tasks: [
        {
          title: `Audit connection/resource limits for ${service} in Helm chart`,
          assignee: 'Unassigned (Ops Team)',
          status: 'TODO',
          priority: severity === 'SEV-0' || severity === 'SEV-1' ? 'CRITICAL' : 'HIGH',
          severity: severity,
          createdAt: now.toISOString()
        },
        {
          title: `Create postmortem doc and link Datadog trace logs for ${service}`,
          assignee: 'Unassigned (Ops Team)',
          status: 'TODO',
          priority: 'MEDIUM',
          severity: severity,
          createdAt: now.toISOString()
        }
      ],
      suggestedFixes: [
        `Scale ${service} pod replicas by +50%`,
        `Tune connection context timeout to 15s`,
        `Verify Redis/DB connection pool saturation metrics in Grafana`
      ]
    };
  }

  // Fetch all tasks across incidents
  public async getTasks(): Promise<ActionItemTask[]> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.getTasks();
    const incidents = await this.getIncidents();
    const allTasks: ActionItemTask[] = [];
    incidents.forEach(inc => {
      if (inc.tasks) {
        allTasks.push(...inc.tasks);
      }
    });
    return allTasks;
  }

  // Update status of a task
  public async updateTaskStatus(taskId: string, status: TaskStatus): Promise<ActionItemTask> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.updateTaskStatus(taskId, status);
    const incidents = await this.getIncidents();
    let updatedTask: ActionItemTask | null = null;

    for (const inc of incidents) {
      const taskIdx = inc.tasks.findIndex(t => t.id === taskId);
      if (taskIdx >= 0) {
        inc.tasks[taskIdx].status = status;
        updatedTask = inc.tasks[taskIdx];
        await this.saveIncident(inc);
        break;
      }
    }

    if (!updatedTask) {
      const incidentId = parseDefaultTaskIncidentId(taskId);
      if (incidentId) {
        const inc = incidents.find((i) => i.id === incidentId);
        if (inc) {
          const defaultTask = buildDefaultTask(inc);
          defaultTask.status = status;
          inc.tasks = [defaultTask];
          await this.saveIncident(inc);
          updatedTask = defaultTask;
        }
      }
    }

    if (!updatedTask) throw new Error(`Task ${taskId} not found`);
    return updatedTask;
  }

  // Memory Vector Search / Chat AI query
  public async queryMemory(queryText: string): Promise<MemoryChatMessage> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.queryMemory(queryText);
    await new Promise(res => setTimeout(res, 1200));

    const lower = queryText.toLowerCase();
    const incidents = await this.getIncidents();

    const matches = incidents.map(inc => {
      let score = 70;
      if (lower.includes(inc.service) || lower.includes(inc.component)) score += 20;
      if (lower.includes('db') || lower.includes('postgres') || lower.includes('pgbouncer') || lower.includes('cockroach')) {
        if (inc.summary.toLowerCase().includes('cockroach') || inc.summary.toLowerCase().includes('pgbouncer')) score += 15;
      }
      if (lower.includes('oom') || lower.includes('k8s') || lower.includes('memory')) {
        if (inc.summary.toLowerCase().includes('oom') || inc.summary.toLowerCase().includes('auth')) score += 15;
      }
      return {
        id: inc.id,
        title: inc.title,
        similarityScore: Math.min(score, 98),
        service: inc.service,
        resolvedDuration: inc.mttrMinutes ? `${inc.mttrMinutes} mins` : '30 mins',
        keyTakeaway: inc.fixesApplied[0] || inc.summary,
        citations: [`Slack #${inc.id}`, `Postmortem #${inc.id}-PM`, `OpsRelay Vector Chunk #${Math.floor(Math.random()*800+100)}`],
        severity: inc.severity,
        resolvedDate: inc.resolvedAt ? inc.resolvedAt.split('T')[0] : '2026-07-25'
      };
    }).sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 2);

    const timeStr = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;

    const replyText = `OpsRelay Vector Memory queried 1,480 past incident records.\n\nFound **${matches.length} closely relevant incident patterns** (${matches[0]?.similarityScore}% highest similarity):\n\n` +
      matches.map(m => `* **${m.id} (${m.title})**: ${m.keyTakeaway}`).join('\n\n') +
      `\n\n**Recommended Runbook Action:** Verify pool sizes and active gRPC transaction timeouts before expanding cluster replicas.`;

    const chatMessage: MemoryChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      text: replyText,
      timestamp: timeStr,
      matchedIncidents: matches,
      suggestedRunbooks: [
        {
          title: `${matches[0]?.service || 'System'} Diagnostic Runbook`,
          url: `https://internal-wiki.opsrelay.io/runbooks/${matches[0]?.service || 'general'}`,
          codeSnippet: `OpsRelay-cli analyze --service ${matches[0]?.service || 'billing-service'} --timeframe 1h`
        }
      ]
    };

    const data = localStorage.getItem(STORAGE_KEYS.CHATS);
    const chats: MemoryChatMessage[] = data ? JSON.parse(data) : INITIAL_MEMORY_CHATS;
    chats.push({ id: 'user-' + Date.now(), sender: 'user', text: queryText, timestamp: timeStr });
    chats.push(chatMessage);
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));

    return chatMessage;
  }

  // Get full chat history
  public async getMemoryChats(): Promise<MemoryChatMessage[]> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.getMemoryChats();
    const data = localStorage.getItem(STORAGE_KEYS.CHATS);
    return data ? JSON.parse(data) : INITIAL_MEMORY_CHATS;
  }

  // Clear chat history
  public async clearMemoryChats(): Promise<void> {
    if (USE_CRDB) {
      await crdbClient.clearMemoryChats();
      return;
    }
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify([]));
  }

  /** Returns true when connected to CockroachDB backend */
  public isUsingCrdb(): boolean {
    return USE_CRDB;
  }

  /** Sample raw logs for AI Intake (from DB or local mock) */
  public async getSampleLogs(): Promise<Array<{ id: string; title: string; content: string; category?: string }>> {
    if (USE_CRDB) return crdbClient.getSampleLogs();
    const stored = localStorage.getItem('opsrelay_sample_logs');
    if (stored) return JSON.parse(stored);
    const { RAW_LOG_SAMPLE_TEMPLATES } = await import('../data/mockData');
    return RAW_LOG_SAMPLE_TEMPLATES;
  }

  /** Save a new sample log to DB (quick intake) */
  public async saveSampleLog(log: { title: string; content: string; category?: string }): Promise<{ id: string; title: string; content: string; category?: string }> {
    await this.checkError();
    if (USE_CRDB) return crdbClient.saveSampleLog(log);
    const { RAW_LOG_SAMPLE_TEMPLATES } = await import('../data/mockData');
    const id = `log-local-${Date.now().toString(36)}`;
    const entry = { id, ...log, category: log.category ?? 'manual' };
    const stored = localStorage.getItem('opsrelay_sample_logs');
    const list = stored ? JSON.parse(stored) as typeof entry[] : [...RAW_LOG_SAMPLE_TEMPLATES];
    list.push(entry);
    localStorage.setItem('opsrelay_sample_logs', JSON.stringify(list));
    return entry;
  }

  /** Ping the CockroachDB API health endpoint */
  public async checkDbHealth(): Promise<{ ok: boolean; message: string }> {
    if (!USE_CRDB) {
      return { ok: true, message: 'localStorage mode' };
    }
    try {
      const health = await crdbClient.health();
      return { ok: health.status === 'ok', message: health.database };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'API unreachable' };
    }
  }

  public async getAgentStatus() {
    if (!USE_CRDB) {
      return { bedrockEnabled: false, embedMode: 'local', embeddingCount: 0, incidentCount: 0, vectorSearchReady: false, agentReady: false };
    }
    return crdbClient.getAgentStatus();
  }

  public async runAgent(query: string, incidentId?: string, saveChat = true) {
    if (!USE_CRDB) throw new Error('AI Agent requires CockroachDB. Set VITE_USE_CRDB=true');
    return crdbClient.runAgent(query, incidentId, saveChat);
  }

  public async rebuildVectorIndex() {
    if (!USE_CRDB) throw new Error('Vector index requires CockroachDB. Set VITE_USE_CRDB=true');
    return crdbClient.rebuildVectorIndex();
  }

  public async login(identifier: string, password: string) {
    if (!USE_CRDB) throw new Error('Login requires CockroachDB. Set VITE_USE_CRDB=true');
    return crdbClient.login(identifier, password);
  }

  public async register(input: import('../types/auth').RegisterInput) {
    if (!USE_CRDB) throw new Error('Registration requires CockroachDB. Set VITE_USE_CRDB=true');
    return crdbClient.register(input);
  }

  public async getCurrentUser() {
    if (!USE_CRDB) throw new Error('Auth requires CockroachDB. Set VITE_USE_CRDB=true');
    const { user } = await crdbClient.getCurrentUser();
    return user;
  }

  public async shareIncidentWithMember(incidentId: string, memberId: string) {
    if (!USE_CRDB) throw new Error('Sharing requires CockroachDB');
    return crdbClient.shareIncident(incidentId, memberId);
  }

  public async requestIncidentAccess(ownerMemberId: string, message?: string) {
    if (!USE_CRDB) throw new Error('Access sharing requires CockroachDB');
    return crdbClient.requestIncidentAccess(ownerMemberId, message);
  }

  public async getIncomingAccessRequests() {
    if (!USE_CRDB) return [];
    return crdbClient.getIncomingAccessRequests();
  }

  public async getOutgoingAccessRequests() {
    if (!USE_CRDB) return [];
    return crdbClient.getOutgoingAccessRequests();
  }

  public async getAccessGrants() {
    if (!USE_CRDB) return [];
    return crdbClient.getAccessGrants();
  }

  public async approveAccessRequest(id: string) {
    if (!USE_CRDB) throw new Error('Access sharing requires CockroachDB');
    return crdbClient.approveAccessRequest(id);
  }

  public async rejectAccessRequest(id: string) {
    if (!USE_CRDB) throw new Error('Access sharing requires CockroachDB');
    return crdbClient.rejectAccessRequest(id);
  }
}

export const apiService = new ApiService();

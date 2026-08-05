/**
 * HTTP client for OpsRelay CockroachDB backend.
 * Used when VITE_USE_CRDB=true (see .env.example).
 */

import { getAuthToken } from './authStorage';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && path !== '/auth/login') {
    unauthorizedHandler?.();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const crdbClient = {
  login: (identifier: string, password: string) =>
    request<{ token: string; user: import('../types/auth').AuthUser; expiresIn: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  register: (input: import('../types/auth').RegisterInput) =>
    request<{ token: string; user: import('../types/auth').AuthUser; expiresIn: string; message?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getCurrentUser: () =>
    request<{ user: import('../types/auth').AuthUser }>('/auth/me'),
  getAuthStatus: () => request<{ authEnabled: boolean }>('/auth/status'),
  getMetrics: () => request<import('../types/incident').DashboardMetrics>('/metrics'),
  getShiftHandoff: () => request<import('../types/incident').ShiftHandoff>('/handoff'),
  acknowledgeShiftHandoff: () =>
    request<import('../types/incident').ShiftHandoff>('/handoff/acknowledge', { method: 'POST' }),
  getIncidents: () => request<import('../types/incident').Incident[]>('/incidents'),
  getIncidentById: (id: string) => request<import('../types/incident').Incident>(`/incidents/${id}`),
  createIntakeIncident: (input: { title?: string; rawNotes: string; shareWithMemberId?: string }) =>
    request<import('../types/alertFatigue').IntakeIncidentResponse>('/incidents', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  patchIncident: (id: string, body: Record<string, unknown>) =>
    request<import('../types/incident').Incident>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  startAnalysis: (incidentId: string, idempotencyKey: string) =>
    request<import('../types/alertFatigue').AnalysisRun>(`/incidents/${incidentId}/analysis`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  getAnalysisCurrent: (incidentId: string) =>
    request<import('../types/alertFatigue').AnalysisCurrentResponse>(
      `/incidents/${incidentId}/analysis/current`,
    ),
  approveAnalysis: (incidentId: string, runId: string, draft: Record<string, unknown>) =>
    request<import('../types/incident').Incident>(
      `/incidents/${incidentId}/analysis/${runId}/approve`,
      { method: 'POST', body: JSON.stringify(draft) },
    ),
  saveIncident: async (
    incident: import('../types/incident').Incident,
    options?: { shareWithMemberId?: string },
  ) => {
    const intake = await crdbClient.createIntakeIncident({
      title: incident.title,
      rawNotes: incident.rawNotes ?? incident.summary,
      shareWithMemberId: options?.shareWithMemberId,
    });
    const { id: _id, ...rest } = incident;
    return crdbClient.patchIncident(intake.id, {
      ...rest,
      id: intake.id,
      analysisStatus: 'approved',
    });
  },
  updateIncidentStatus: (id: string, status: import('../types/incident').IncidentStatus) =>
    request<import('../types/incident').Incident>(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  extractIncidentFromNotes: (rawNotes: string) =>
    request<import('../types/incident').ExtractionResult>('/extract', {
      method: 'POST',
      body: JSON.stringify({ rawNotes }),
    }),
  getTasks: () => request<import('../types/incident').ActionItemTask[]>('/tasks'),
  updateTaskStatus: (taskId: string, status: import('../types/incident').TaskStatus) =>
    request<import('../types/incident').ActionItemTask>(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  queryMemory: (queryText: string) =>
    request<import('../types/incident').MemoryChatMessage>('/memory/query', {
      method: 'POST',
      body: JSON.stringify({ queryText }),
    }),
  getMemoryChats: () => request<import('../types/incident').MemoryChatMessage[]>('/memory'),
  clearMemoryChats: () => request<void>('/memory', { method: 'DELETE' }),
  health: () => request<{ status: string; database: string; bedrock?: unknown; vectors?: unknown; auth?: { enabled: boolean } }>('/health'),
  getAgentStatus: () =>
    request<{
      bedrockEnabled: boolean;
      embedMode: string;
      embeddingCount: number;
      incidentCount: number;
      vectorSearchReady: boolean;
      agentReady: boolean;
    }>('/agent/status'),
  runAgent: (query: string, incidentId?: string, saveChat = true) =>
    request<{
      answer: string;
      similarIncidents: unknown[];
      steps: unknown[];
      suggestedTasks: unknown[];
      mode: string;
      embeddingCount: number;
    }>('/agent/run', {
      method: 'POST',
      body: JSON.stringify({ query, incidentId, saveChat }),
    }),
  rebuildVectorIndex: () =>
    request<{ indexed: number; totalEmbeddings: number }>('/agent/index', { method: 'POST' }),
  getSampleLogs: () =>
    request<Array<{ id: string; title: string; content: string; category?: string }>>('/sample-logs'),
  saveSampleLog: (log: { title: string; content: string; category?: string; id?: string }) =>
    request<{ id: string; title: string; content: string; category?: string }>('/sample-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    }),
  shareIncident: (incidentId: string, memberId: string) =>
    request<{ incidentId: string; sharedWithMemberIds: string[] }>(`/incidents/${incidentId}/share`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }),
  requestIncidentAccess: (ownerMemberId: string, message?: string) =>
    request<import('../types/access').AccessRequest>('/access/request', {
      method: 'POST',
      body: JSON.stringify({ ownerMemberId, message }),
    }),
  getIncomingAccessRequests: () =>
    request<import('../types/access').AccessRequest[]>('/access/incoming'),
  getOutgoingAccessRequests: () =>
    request<import('../types/access').AccessRequest[]>('/access/outgoing'),
  getAccessGrants: () =>
    request<import('../types/access').AccessGrant[]>('/access/grants'),
  approveAccessRequest: (id: string) =>
    request<import('../types/access').AccessRequest>(`/access/requests/${id}/approve`, { method: 'POST' }),
  rejectAccessRequest: (id: string) =>
    request<import('../types/access').AccessRequest>(`/access/requests/${id}/reject`, { method: 'POST' }),
  listWarRooms: () =>
    request<import('../types/commander').ActiveWarRoom[]>('/commander'),
  getWarRoom: (incidentId: string) =>
    request<import('../types/commander').WarRoomState>(`/commander/${incidentId}`),
  getCommanderReplay: (incidentId: string) =>
    request<import('../types/commander').ReplayEvent[]>(`/commander/${incidentId}/replay`),
  launchCommander: (incidentId: string) =>
    request<import('../types/commander').WarRoomState>(`/commander/${incidentId}/launch`, { method: 'POST' }),
  recordCommanderAction: (incidentId: string, body: { title: string; description?: string; outcome?: string }) =>
    request<import('../types/commander').RecordActionResult>(`/commander/${incidentId}/actions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  acknowledgeCommander: (incidentId: string, _memberId: string) =>
    request<import('../types/commander').WarRoomState>(`/commander/${incidentId}/acknowledge`, { method: 'POST' }),
  escalateCommander: (incidentId: string) =>
    request<import('../types/commander').WarRoomState>(`/commander/${incidentId}/escalate`, { method: 'POST' }),
  resolveCommander: (incidentId: string) =>
    request<import('../types/commander').WarRoomState>(`/commander/${incidentId}/resolve`, { method: 'POST' }),
  listTeamChats: () =>
    request<import('../types/teamChat').TeamChatSummary[]>('/team-chat'),
  listTeamChatMembers: () =>
    request<import('../types/teamChat').TeamChatMember[]>('/team-chat/members'),
  createTeamChat: (memberId: string) =>
    request<import('../types/teamChat').TeamChatDetail>('/team-chat', {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }),
  getTeamChat: (chatId: string) =>
    request<import('../types/teamChat').TeamChatDetail>(`/team-chat/${chatId}`),
  sendTeamChatMessage: (chatId: string, input: import('../types/teamChat').SendTeamChatMessageInput) =>
    request<import('../types/teamChat').TeamChatMessage>(`/team-chat/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  inviteTeamChatGuest: (chatId: string, memberId: string, durationMinutes: import('../types/teamChat').GuestDuration) =>
    request<import('../types/teamChat').TeamChatDetail>(`/team-chat/${chatId}/guests`, {
      method: 'POST',
      body: JSON.stringify({ memberId, durationMinutes }),
    }),
  removeTeamChatGuest: (chatId: string, guestId: string) =>
    request<import('../types/teamChat').TeamChatDetail>(`/team-chat/${chatId}/guests/${guestId}`, {
      method: 'DELETE',
    }),
  deleteTeamChatMessage: (chatId: string, messageId: string) =>
    request<{ deleted: true; messageId: string }>(`/team-chat/${chatId}/messages/${messageId}`, {
      method: 'DELETE',
    }),
  deleteTeamChat: (chatId: string) =>
    request<{ deleted: true; chatId: string }>(`/team-chat/${chatId}`, {
      method: 'DELETE',
    }),
  getAlertStatsForIncident: (incidentId: string) =>
    request<import('../types/alertFatigue').AlertIncidentStats | { suppressedCount: number; summaryMessage: null }>(
      `/alerts/incident/${incidentId}/stats`,
    ),
  overrideAlertDistinct: (alertId: string) =>
    request<{ alertId: string; message: string; forceDistinct: boolean }>(
      `/alerts/${alertId}/override-distinct`,
      { method: 'POST' },
    ),
  getInvestigatorStatus: () =>
    request<import('../types/investigator').InvestigatorStatus>('/investigator/status'),
  queryInvestigator: (question: string, incidentId?: string) =>
    request<import('../types/investigator').InvestigationResult>('/investigator/query', {
      method: 'POST',
      body: JSON.stringify({ question, incidentId }),
    }),
};

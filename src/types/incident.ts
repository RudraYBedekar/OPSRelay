export type Severity = 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  actor: 'OpsRelay AI' | 'SRE Team' | 'System Monitor' | 'PagerDuty' | 'K8s Cluster';
  type: 'alert' | 'action' | 'decision' | 'fix' | 'detection';
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  madeBy: string;
  timestamp: string;
  impact: string;
}

export interface ActionItemTask {
  id: string;
  incidentId: string;
  incidentTitle: string;
  title: string;
  assignee: string;
  status: TaskStatus;
  priority: TaskPriority;
  severity: Severity;
  createdAt: string;
}

export interface RelatedIncident {
  id: string;
  title: string;
  similarityScore: number; // 0-100 percentage
  service: string;
  resolvedDuration: string;
  keyTakeaway: string;
  citations: string[];
  severity: Severity;
  resolvedDate: string;
}

export interface Incident {
  id: string;
  title: string;
  service: string;
  component: string;
  severity: Severity;
  status: IncidentStatus;
  summary: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  mttrMinutes?: number;
  leadSRE: string;
  shiftId: string;
  ownerMemberId?: string;
  ownerName?: string;
  sharedWithMemberIds?: string[];
  timeline: TimelineEvent[];
  decisions: Decision[];
  fixesApplied: string[];
  tasks: ActionItemTask[];
  rawNotes?: string;
  aiConfidence: number; // e.g., 94 for 94%
  similarIncidents: RelatedIncident[];
  analysisStatus?: 'not_started' | 'running' | 'review_required' | 'approved' | 'failed';
  duplicateCandidate?: import('./alertFatigue').DuplicateCandidate;
}

export interface ExtractionResult {
  title?: string;
  severity: Severity;
  severityReason: string;
  service: string;
  component: string;
  summary: string;
  timeline: Omit<TimelineEvent, 'id'>[];
  decisions: Omit<Decision, 'id'>[];
  tasks: Omit<ActionItemTask, 'id' | 'incidentId' | 'incidentTitle'>[];
  confidenceScore: number;
  suggestedFixes: string[];
}

export interface MemoryChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  matchedIncidents?: RelatedIncident[];
  suggestedRunbooks?: { title: string; url: string; codeSnippet?: string }[];
  agentMode?: string;
  linkedIncidentId?: string;
  ownerMemberId?: string;
  mcpCitations?: import('./investigator').McpCitation[];
}

export interface ShiftHandoff {
  shiftId: string;
  timestamp: string;
  outgoingLead: string;
  incomingLead: string;
  activeSevCount: number;
  openTasksCount: number;
  keySummaries: string[];
  handshakeStatus: 'PENDING' | 'ACKNOWLEDGED';
}

export interface DashboardMetrics {
  totalIncidents24h: number;
  activeSev0Sev1: number;
  avgMttrMinutes: number;
  aiExtractionAccuracy: number;
  openTasksCount: number;
  timeSavedHours: number;
}

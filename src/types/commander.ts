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

export interface SimilarIncidentMatch {
  id: string;
  title: string;
  service: string;
  similarityScore: number;
  keyTakeaway: string;
}

export interface WarRoomState {
  session: CommanderSession;
  incident: Record<string, unknown>;
  decisions: CommanderDecision[];
  assignments: CommanderAssignment[];
  actions: CommanderAction[];
  replay: ReplayEvent[];
  similarIncidents: SimilarIncidentMatch[];
  slaRemainingMs: number;
  responseRemainingMs: number;
  mode: 'bedrock' | 'local';
}

export interface ActiveWarRoom {
  incidentId: string;
  session: CommanderSession;
  incidentTitle: string;
  severity: string;
}

export interface RecordActionResult {
  action: CommanderAction;
  warning?: string;
}

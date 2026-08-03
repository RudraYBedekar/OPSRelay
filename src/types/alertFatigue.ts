export type AlertStatus = 'active' | 'noise' | 'resolved';

export interface AlertMatchSummary {
  id: string;
  linkedIncidentId?: string;
  service: string;
  firstSeen: string;
  lastSeen: string;
  suppressedCount: number;
  status: AlertStatus;
  similarity: number;
}

export interface DuplicateCandidate {
  state: 'none' | 'checking' | 'candidate' | 'confirmed-distinct' | 'merged' | 'failed';
  matchedAlertId?: string;
  matchedIncidentId?: string;
  similarity?: number;
  message?: string;
  match?: AlertMatchSummary;
}

export interface AlertIncidentStats {
  alertId: string;
  suppressedCount: number;
  firstSeen: string;
  lastSeen: string;
  hoursSinceFirst: number;
  status: AlertStatus;
  summaryMessage: string;
}

export interface AnalysisRun {
  id: string;
  incidentId: string;
  status: string;
  outputJson?: import('./incident').ExtractionResult;
  confidence?: number;
  warnings: unknown[];
  errorCode?: string;
  createdAt: string;
  completedAt?: string;
  approvedAt?: string;
}

export interface AnalysisCurrentResponse {
  run: AnalysisRun | null;
  jobs: Array<{ jobType: string; status: string; lastErrorCode?: string }>;
  analysisStatus: string;
}

export interface IntakeIncidentResponse {
  id: string;
  status: string;
  analysisStatus: string;
  savedAt?: string;
  title?: string;
  rawNotes?: string;
}

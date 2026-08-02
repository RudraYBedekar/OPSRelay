export type AlertStatus = 'active' | 'noise' | 'resolved';

export interface AlertRecord {
  id: string;
  alertText: string;
  service: string;
  firstSeen: string;
  lastSeen: string;
  suppressedCount: number;
  linkedIncidentId?: string;
  status: AlertStatus;
  distinctOverride: boolean;
  similarity?: number;
}

export interface AlertEvaluationResult {
  suppressed: boolean;
  matchedAlert?: AlertRecord;
  similarity?: number;
  message?: string;
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

export interface AlertSuppressedResponse {
  suppressed: true;
  matchedAlert?: AlertRecord;
  similarity?: number;
  message?: string;
}

export class AlertSuppressedError extends Error {
  readonly payload: AlertSuppressedResponse;

  constructor(payload: AlertSuppressedResponse) {
    super(payload.message ?? 'Alert suppressed as duplicate noise');
    this.name = 'AlertSuppressedError';
    this.payload = payload;
  }
}

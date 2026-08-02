import type { Incident, Severity } from '../types/incident';
import { withDefaultTasks } from './incidentTasks';

export interface QuickIncidentInput {
  title: string;
  notes: string;
  service?: string;
  severity?: Severity;
  leadSRE?: string;
}

/** Build a minimal incident document from a title and a few lines of logs. ID is assigned by the server on save. */
export function buildQuickIncident(input: QuickIncidentInput): Incident {
  const now = new Date();
  const notes = input.notes.trim();
  const firstLine = notes.split('\n').find((l) => l.trim()) ?? input.title.trim();

  return withDefaultTasks({
    id: 'pending',
    title: input.title.trim(),
    service: input.service?.trim() || 'general',
    component: 'manual-intake',
    severity: input.severity ?? 'SEV-2',
    status: 'OPEN',
    summary: firstLine.slice(0, 280),
    createdAt: now.toISOString(),
    leadSRE: input.leadSRE?.trim() || 'Yash',
    shiftId: 'SHIFT-CURRENT',
    aiConfidence: 0,
    rawNotes: notes,
    timeline: [
      {
        id: 'tl-manual-0',
        timestamp: now.toISOString().slice(11, 19),
        title: 'Manual quick intake',
        description: firstLine.slice(0, 400),
        actor: 'SRE Team',
        type: 'detection',
      },
    ],
    decisions: [],
    fixesApplied: [],
    tasks: [],
    similarIncidents: [],
  });
}

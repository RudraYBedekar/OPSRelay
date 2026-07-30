import type { ActionItemTask, Incident, Severity, TaskPriority } from '../types/incident';

function severityToPriority(severity: Severity): TaskPriority {
  if (severity === 'SEV-0') return 'CRITICAL';
  if (severity === 'SEV-1') return 'HIGH';
  if (severity === 'SEV-2') return 'MEDIUM';
  return 'LOW';
}

export function buildDefaultTask(incident: Pick<Incident, 'id' | 'title' | 'severity' | 'leadSRE' | 'createdAt'>): ActionItemTask {
  return {
    id: `tsk-${incident.id}-triage`,
    incidentId: incident.id,
    incidentTitle: incident.title,
    title: `Triage and investigate: ${incident.title}`,
    assignee: incident.leadSRE || 'Unassigned (Ops Team)',
    status: 'TODO',
    priority: severityToPriority(incident.severity),
    severity: incident.severity,
    createdAt: incident.createdAt,
  };
}

/** Ensure open incidents always have at least one task for the task board. */
export function ensureIncidentTasks(incident: Incident): ActionItemTask[] {
  const existing = (incident.tasks ?? []).map((task) => ({
    ...task,
    incidentId: task.incidentId || incident.id,
    incidentTitle: task.incidentTitle || incident.title,
  }));

  if (existing.length > 0) return existing;
  if (incident.status === 'RESOLVED') return [];

  return [buildDefaultTask(incident)];
}

export function withDefaultTasks(incident: Incident): Incident {
  return {
    ...incident,
    tasks: ensureIncidentTasks(incident),
  };
}

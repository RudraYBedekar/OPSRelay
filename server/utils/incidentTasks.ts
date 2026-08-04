type Severity = 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3';
type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';

export interface IncidentTask {
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

export interface IncidentWithTasks {
  id: string;
  title: string;
  severity: Severity;
  status: string;
  service?: string;
  summary?: string;
  leadSRE?: string;
  createdAt?: string;
  ownerMemberId?: string;
  ownerName?: string;
  sharedWithMemberIds?: string[];
  analysisStatus?: string;
  tasks?: IncidentTask[];
}

function severityToPriority(severity: Severity): TaskPriority {
  if (severity === 'SEV-0') return 'CRITICAL';
  if (severity === 'SEV-1') return 'HIGH';
  if (severity === 'SEV-2') return 'MEDIUM';
  return 'LOW';
}

export function buildDefaultTask(incident: IncidentWithTasks): IncidentTask {
  const createdAt = incident.createdAt ?? new Date().toISOString();
  return {
    id: defaultTaskId(incident.id),
    incidentId: incident.id,
    incidentTitle: incident.title,
    title: `Triage and investigate: ${incident.title}`,
    assignee: incident.leadSRE ?? 'Unassigned (Ops Team)',
    status: 'TODO',
    priority: severityToPriority(incident.severity),
    severity: incident.severity,
    createdAt,
  };
}

export function defaultTaskId(incidentId: string): string {
  return `tsk-${incidentId}-triage`;
}

/** Parse incident id from a synthetic default task id (`tsk-INC-123-triage`). */
export function parseDefaultTaskIncidentId(taskId: string): string | null {
  if (!taskId.startsWith('tsk-') || !taskId.endsWith('-triage')) return null;
  const incidentId = taskId.slice(4, -7);
  return incidentId.length > 0 ? incidentId : null;
}

/** Ensure every open incident has at least one trackable task for the task board. */
export function ensureIncidentTasks(incident: IncidentWithTasks): IncidentTask[] {
  const existing = (incident.tasks ?? []).map((task) => ({
    ...task,
    incidentId: task.incidentId ?? incident.id,
    incidentTitle: task.incidentTitle ?? incident.title,
  }));

  if (existing.length > 0) return existing;
  if (incident.status === 'RESOLVED') return [];

  return [buildDefaultTask(incident)];
}

export function normalizeIncidentForSave<T extends IncidentWithTasks>(incident: T): T {
  return {
    ...incident,
    tasks: ensureIncidentTasks(incident),
  };
}

export function flattenIncidentTasks(
  rows: Array<{ id: string; data: IncidentWithTasks }>,
): IncidentTask[] {
  return rows.flatMap((row) => {
    const incident = { ...row.data, id: row.data.id ?? row.id };
    return ensureIncidentTasks(incident);
  });
}

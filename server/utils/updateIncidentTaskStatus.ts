import { query, queryOne } from '../db.js';
import {
  buildDefaultTask,
  parseTaskIncidentId,
  type IncidentTask,
  type IncidentWithTasks,
} from './incidentTasks.js';
import { canEditIncident } from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';
import type { AuthUser } from '../services/authService.js';
import type { ValidatedTaskStatus } from '../schemas/taskStatus.js';

export async function updateIncidentTaskStatus(
  incidentId: string,
  taskId: string,
  status: ValidatedTaskStatus,
  viewer?: AuthUser,
): Promise<IncidentTask> {
  const row = await queryOne<{ id: string; data: Record<string, unknown>; updated_at: string }>(
    'SELECT id, data, updated_at FROM incidents WHERE id = $1',
    [incidentId],
  );
  if (!row) {
    throw Object.assign(new Error(`Task ${taskId} not found`), { status: 404 });
  }

  const incident = {
    ...(row.data as unknown as IncidentWithTasks),
    ownerMemberId: typeof row.data.ownerMemberId === 'string' ? row.data.ownerMemberId : undefined,
  };

  if (isAuthEnabled() && viewer) {
    if (!canEditIncident(incident, viewer)) {
      throw Object.assign(new Error(`Task ${taskId} not found`), { status: 404 });
    }
  }

  const tasks = (row.data.tasks ?? []) as IncidentTask[];
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx >= 0) {
    tasks[idx].status = status;
    row.data.tasks = tasks;
    await query(
      'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
      [row.id, JSON.stringify(row.data)],
    );
    return tasks[idx];
  }

  const defaultTask = buildDefaultTask(incident);
  if (defaultTask.id === taskId) {
    defaultTask.status = status;
    const data = { ...row.data, tasks: [defaultTask] };
    await query(
      'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
      [row.id, JSON.stringify(data)],
    );
    return defaultTask;
  }

  throw Object.assign(new Error(`Task ${taskId} not found`), { status: 404 });
}

export async function updateTaskStatusById(
  taskId: string,
  status: ValidatedTaskStatus,
  viewer?: AuthUser,
): Promise<IncidentTask> {
  const incidentId = parseTaskIncidentId(taskId);
  if (!incidentId) {
    throw Object.assign(new Error(`Task ${taskId} not found`), { status: 404 });
  }
  return updateIncidentTaskStatus(incidentId, taskId, status, viewer);
}

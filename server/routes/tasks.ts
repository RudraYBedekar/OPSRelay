import { Router } from 'express';
import { query } from '../db.js';
import {
  flattenIncidentTasks,
  type IncidentWithTasks,
} from '../utils/incidentTasks.js';
import { filterIncidentsForUser } from '../services/incidentAccessService.js';
import { parseTaskStatus } from '../schemas/taskStatus.js';
import { updateTaskStatusById } from '../utils/updateIncidentTaskStatus.js';

export const tasksRouter = Router();

tasksRouter.get('/', async (req, res, next) => {
  try {
    const rows = await query<{ id: string; data: IncidentWithTasks }>(
      'SELECT id, data FROM incidents ORDER BY updated_at DESC',
    );
    const visible = await filterIncidentsForUser(
      rows.map((row) => ({ ...row.data, id: row.data.id ?? row.id })),
      req.user,
    );
    const visibleIds = new Set(visible.map((i) => i.id));
    const filteredRows = rows.filter((row) => visibleIds.has(row.data.id ?? row.id));
    res.json(flattenIncidentTasks(filteredRows));
  } catch (err) {
    next(err);
  }
});

/** Legacy route — resolves incident from task id pattern; prefer scoped PATCH on incidents router. */
tasksRouter.patch('/:taskId/status', async (req, res, next) => {
  try {
    const status = parseTaskStatus(req.body);
    const task = await updateTaskStatusById(req.params.taskId, status, req.user);
    res.json(task);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Task not found' });
      return;
    }
    next(err);
  }
});

import { Router } from 'express';
import { query, queryOne } from '../db.js';
import {
  buildDefaultTask,
  flattenIncidentTasks,
  parseDefaultTaskIncidentId,
  type IncidentTask,
  type IncidentWithTasks,
} from '../utils/incidentTasks.js';
import {
  canEditIncident,
  filterIncidentsForUser,
} from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';

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

tasksRouter.patch('/:taskId/status', async (req, res, next) => {
  try {
    const taskId = req.params.taskId;
    const status = req.body.status as IncidentTask['status'];

    const rows = await query<{ id: string; data: Record<string, unknown> }>(
      'SELECT id, data FROM incidents',
    );

    for (const row of rows) {
      const tasks = (row.data.tasks ?? []) as IncidentTask[];
      const idx = tasks.findIndex((t) => t.id === taskId);
      if (idx >= 0) {
        const incident = row.data as IncidentWithTasks & { ownerMemberId?: string };
        if (isAuthEnabled() && req.user) {
          if (!canEditIncident(incident, req.user)) {
            res.status(404).json({ error: `Task ${taskId} not found` });
            return;
          }
        }
        tasks[idx].status = status;
        row.data.tasks = tasks;
        await query(
          'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
          [row.id, JSON.stringify(row.data)],
        );
        res.json(tasks[idx]);
        return;
      }
    }

    const incidentId = parseDefaultTaskIncidentId(taskId);
    if (incidentId) {
      const row = await queryOne<{ id: string; data: IncidentWithTasks }>(
        'SELECT id, data FROM incidents WHERE id = $1',
        [incidentId],
      );
      if (!row) {
        res.status(404).json({ error: `Task ${taskId} not found` });
        return;
      }

      const incident = { ...row.data, id: row.data.id ?? row.id };
      if (isAuthEnabled() && req.user) {
        if (!canEditIncident(incident, req.user)) {
          res.status(404).json({ error: `Task ${taskId} not found` });
          return;
        }
      }

      const defaultTask = buildDefaultTask(incident);
      if (defaultTask.id !== taskId) {
        res.status(404).json({ error: `Task ${taskId} not found` });
        return;
      }

      defaultTask.status = status;
      const data = { ...row.data, tasks: [defaultTask] };
      await query(
        'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
        [row.id, JSON.stringify(data)],
      );
      res.json(defaultTask);
      return;
    }

    res.status(404).json({ error: `Task ${taskId} not found` });
  } catch (err) {
    next(err);
  }
});

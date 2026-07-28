import { Router } from 'express';
import { query } from '../db.js';

export const tasksRouter = Router();

tasksRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query<{ data: { tasks?: unknown[] } }>(
      'SELECT data FROM incidents ORDER BY updated_at DESC',
    );
    const tasks = rows.flatMap((r) => r.data.tasks ?? []);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

tasksRouter.patch('/:taskId/status', async (req, res, next) => {
  try {
    const rows = await query<{ id: string; data: Record<string, unknown> }>(
      'SELECT id, data FROM incidents',
    );

    for (const row of rows) {
      const tasks = (row.data.tasks ?? []) as Array<{ id: string; status: string }>;
      const idx = tasks.findIndex((t) => t.id === req.params.taskId);
      if (idx >= 0) {
        tasks[idx].status = req.body.status;
        row.data.tasks = tasks;
        await query(
          'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
          [row.id, JSON.stringify(row.data)],
        );
        res.json(tasks[idx]);
        return;
      }
    }

    res.status(404).json({ error: `Task ${req.params.taskId} not found` });
  } catch (err) {
    next(err);
  }
});

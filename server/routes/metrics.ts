import { Router } from 'express';
import { queryOne } from '../db.js';

export const metricsRouter = Router();

metricsRouter.get('/', async (_req, res, next) => {
  try {
    const row = await queryOne<{ data: unknown }>(
      "SELECT data FROM dashboard_metrics WHERE id = 'current'",
    );
    if (!row) {
      res.status(404).json({ error: 'Metrics not seeded. Run npm run db:seed' });
      return;
    }
    res.json(row.data);
  } catch (err) {
    next(err);
  }
});

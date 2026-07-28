import { Router } from 'express';
import { query, queryOne } from '../db.js';

export const handoffRouter = Router();

handoffRouter.get('/', async (_req, res, next) => {
  try {
    const row = await queryOne<{ data: unknown }>(
      "SELECT data FROM shift_handoffs WHERE id = 'current'",
    );
    if (!row) {
      res.status(404).json({ error: 'Shift handoff not seeded. Run npm run db:seed' });
      return;
    }
    res.json(row.data);
  } catch (err) {
    next(err);
  }
});

handoffRouter.post('/acknowledge', async (_req, res, next) => {
  try {
    const row = await queryOne<{ data: Record<string, unknown> }>(
      "SELECT data FROM shift_handoffs WHERE id = 'current'",
    );
    if (!row) {
      res.status(404).json({ error: 'Shift handoff not found' });
      return;
    }
    row.data.handshakeStatus = 'ACKNOWLEDGED';
    await query(
      "UPDATE shift_handoffs SET data = $1::jsonb WHERE id = 'current'",
      [JSON.stringify(row.data)],
    );
    res.json(row.data);
  } catch (err) {
    next(err);
  }
});

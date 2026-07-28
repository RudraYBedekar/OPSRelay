import { Router } from 'express';
import { query } from '../db.js';

export const sampleLogsRouter = Router();

export interface SampleLogRecord {
  id: string;
  title: string;
  content: string;
  category?: string;
}

sampleLogsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query<{ id: string; data: SampleLogRecord }>(
      'SELECT id, data FROM sample_logs ORDER BY id ASC',
    );
    res.json(rows.map((r) => ({ ...r.data, id: r.id })));
  } catch (err) {
    next(err);
  }
});

/** Create or update a sample log (quick intake) */
sampleLogsRouter.post('/', async (req, res, next) => {
  try {
    const { title, content, category, id: bodyId } = req.body as Partial<SampleLogRecord>;
    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: 'title and content are required' });
      return;
    }

    const id = bodyId?.trim() || `log-${Date.now().toString(36)}`;
    const data: SampleLogRecord = {
      id,
      title: title.trim(),
      content: content.trim(),
      category: category?.trim() || 'manual',
    };

    await query(
      `INSERT INTO sample_logs (id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = $2::jsonb`,
      [id, JSON.stringify({ title: data.title, content: data.content, category: data.category })],
    );

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

sampleLogsRouter.get('/:id', async (req, res, next) => {
  try {
    const rows = await query<{ id: string; data: SampleLogRecord }>(
      'SELECT id, data FROM sample_logs WHERE id = $1',
      [req.params.id],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Sample log not found' });
      return;
    }
    res.json({ ...rows[0].data, id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

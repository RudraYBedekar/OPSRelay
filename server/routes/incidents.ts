import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { indexIncident, type IncidentRecord } from '../services/vectorService.js';
import { normalizeIncidentForSave } from '../utils/incidentTasks.js';

export const incidentsRouter = Router();

incidentsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query<{ data: Record<string, unknown>; updated_at: string }>(
      'SELECT data, updated_at FROM incidents ORDER BY updated_at DESC',
    );
    res.json(
      rows.map((r) => ({
        ...r.data,
        updatedAt: r.updated_at,
      })),
    );
  } catch (err) {
    next(err);
  }
});

incidentsRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await queryOne<{ data: unknown }>(
      'SELECT data FROM incidents WHERE id = $1',
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }
    res.json(row.data);
  } catch (err) {
    next(err);
  }
});

incidentsRouter.post('/', async (req, res, next) => {
  try {
    const incident = normalizeIncidentForSave(req.body as IncidentRecord & { id: string; title: string; severity: string; status: string });
    await query(
      `INSERT INTO incidents (id, data, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3::timestamptz, now())
       ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = now()`,
      [incident.id, JSON.stringify(incident), incident.createdAt ?? new Date().toISOString()],
    );

    indexIncident(incident).catch((err) =>
      console.warn(`Vector index failed for ${incident.id}:`, err.message),
    );

    res.json(incident);
  } catch (err) {
    next(err);
  }
});

incidentsRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const row = await queryOne<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents WHERE id = $1',
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    const incident = row.data;
    incident.status = req.body.status;

    if (req.body.status === 'RESOLVED' && !incident.resolvedAt) {
      incident.resolvedAt = new Date().toISOString();
      const created = new Date(String(incident.createdAt)).getTime();
      incident.mttrMinutes = Math.round((Date.now() - created) / 60000) || 25;
    }

    await query(
      'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
      [req.params.id, JSON.stringify(incident)],
    );
    res.json(incident);
  } catch (err) {
    next(err);
  }
});

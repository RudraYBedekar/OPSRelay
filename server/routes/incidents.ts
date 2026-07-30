import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { indexIncident, type IncidentRecord } from '../services/vectorService.js';
import { normalizeIncidentForSave } from '../utils/incidentTasks.js';
import {
  canViewIncident,
  filterIncidentsForUser,
  getGrantedOwnerMemberIds,
  normalizeShareTargets,
  shareIncidentWithMember,
} from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';

export const incidentsRouter = Router();

incidentsRouter.get('/', async (req, res, next) => {
  try {
    const rows = await query<{ data: Record<string, unknown>; updated_at: string }>(
      'SELECT data, updated_at FROM incidents ORDER BY updated_at DESC',
    );
    const all = rows.map((r) => ({
      ...r.data,
      updatedAt: r.updated_at,
    }));
    res.json(await filterIncidentsForUser(all, req.user));
  } catch (err) {
    next(err);
  }
});

incidentsRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await queryOne<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents WHERE id = $1',
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    const incident = row.data as { ownerMemberId?: string };
    if (isAuthEnabled() && req.user) {
      const granted = new Set(await getGrantedOwnerMemberIds(req.user.memberId));
      if (!canViewIncident(incident, req.user, granted)) {
        res.status(404).json({ error: `Incident ${req.params.id} not found` });
        return;
      }
    }

    res.json(row.data);
  } catch (err) {
    next(err);
  }
});

incidentsRouter.post('/', async (req, res, next) => {
  try {
    const incident = normalizeIncidentForSave(req.body as IncidentRecord & { id: string; title: string; severity: string; status: string });
    const existing = await queryOne<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents WHERE id = $1',
      [incident.id],
    );
    if (existing?.data?.ownerMemberId) {
      incident.ownerMemberId = String(existing.data.ownerMemberId);
      if (existing.data.ownerName) incident.ownerName = String(existing.data.ownerName);
    } else if (isAuthEnabled() && req.user) {
      incident.ownerMemberId = req.user.memberId;
      incident.ownerName = req.user.name;
    }

    const body = req.body as { shareWithMemberId?: string };
    const shareTargets = [
      ...(incident.sharedWithMemberIds ?? []),
      ...(body.shareWithMemberId ? [body.shareWithMemberId] : []),
    ];
    if (existing?.data?.sharedWithMemberIds) {
      shareTargets.push(...(existing.data.sharedWithMemberIds as string[]));
    }
    if (isAuthEnabled() && req.user && shareTargets.length > 0) {
      incident.sharedWithMemberIds = await normalizeShareTargets(req.user.memberId, shareTargets);
    } else if (shareTargets.length > 0) {
      incident.sharedWithMemberIds = [...new Set(shareTargets.map((id) => id.trim().toUpperCase()))];
    }

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
    if (err instanceof Error && (
      err.message.includes('Invalid member ID') ||
      err.message.includes('No user found')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
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

    const incident = row.data as { ownerMemberId?: string; status?: string; resolvedAt?: string; createdAt?: string; mttrMinutes?: number };
    if (isAuthEnabled() && req.user) {
      const granted = new Set(await getGrantedOwnerMemberIds(req.user.memberId));
      if (!canViewIncident(incident, req.user, granted)) {
        res.status(404).json({ error: `Incident ${req.params.id} not found` });
        return;
      }
    }

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

incidentsRouter.post('/:id/share', async (req, res, next) => {
  try {
    if (!isAuthEnabled() || !req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { memberId } = req.body as { memberId?: string };
    if (!memberId?.trim()) {
      res.status(400).json({ error: 'Recipient member ID is required' });
      return;
    }

    const row = await queryOne<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents WHERE id = $1',
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    const incident = row.data as { ownerMemberId?: string; sharedWithMemberIds?: string[] };
    if (incident.ownerMemberId && incident.ownerMemberId !== req.user.memberId) {
      res.status(403).json({ error: 'Only the incident owner can share this incident' });
      return;
    }

    if (!incident.ownerMemberId) {
      incident.ownerMemberId = req.user.memberId;
    }

    incident.sharedWithMemberIds = await shareIncidentWithMember(incident, req.user, memberId);
    await query(
      'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
      [req.params.id, JSON.stringify(incident)],
    );

    res.json({ incidentId: req.params.id, sharedWithMemberIds: incident.sharedWithMemberIds });
  } catch (err) {
    if (err instanceof Error && (
      err.message.includes('Invalid') ||
      err.message.includes('No user') ||
      err.message.includes('Only the incident owner')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

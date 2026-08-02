import { Router } from 'express';
import { query, queryOne, withTransaction, queryWithClient } from '../db.js';
import { indexIncident, type IncidentRecord } from '../services/vectorService.js';
import { normalizeIncidentForSave } from '../utils/incidentTasks.js';
import { generateIncidentId } from '../utils/incidentId.js';
import { scanAndRedactSecrets, assertNotesSafeForProcessing } from '../utils/redactSecrets.js';
import {
  canViewIncident,
  canEditIncident,
  filterIncidentsForUser,
  getGrantedOwnerMemberIds,
  normalizeShareTargets,
  shareIncidentWithMember,
} from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';
import {
  buildAlertText,
  evaluateAlert,
  recordAlertForIncident,
  markAlertResolvedForIncident,
} from '../services/alertFatigueService.js';

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

/** Create a new incident — server assigns ID; client IDs are ignored. */
incidentsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as IncidentRecord & {
      shareWithMemberId?: string;
      forceDistinct?: boolean;
      overrideAlertId?: string;
      id?: string;
    };

    if (body.id) {
      const existing = await queryOne<{ data: Record<string, unknown> }>(
        'SELECT data FROM incidents WHERE id = $1',
        [body.id],
      );
      if (existing) {
        res.status(409).json({
          error: 'Incident already exists. Use PATCH /incidents/:id to update an existing incident.',
        });
        return;
      }
    }

    const incident = normalizeIncidentForSave(body);
    incident.id = generateIncidentId();

    const rawNotes = (incident as { rawNotes?: string }).rawNotes;
    if (rawNotes?.trim()) {
      assertNotesSafeForProcessing(rawNotes);
      (incident as { rawNotes?: string }).rawNotes = scanAndRedactSecrets(rawNotes).redactedText;
    }

    if (isAuthEnabled() && req.user) {
      incident.ownerMemberId = req.user.memberId;
      incident.ownerName = req.user.name;
    }

    const alertText = buildAlertText({
      title: incident.title,
      summary: incident.summary,
      rawNotes: (incident as { rawNotes?: string }).rawNotes,
    });
    const evaluation = await evaluateAlert(alertText, incident.service, {
      forceDistinct: body.forceDistinct,
      overrideAlertId: body.overrideAlertId,
    });
    if (evaluation.suppressed) {
      res.status(409).json({
        suppressed: true,
        ...evaluation,
      });
      return;
    }

    const shareTargets = [
      ...(incident.sharedWithMemberIds ?? []),
      ...(body.shareWithMemberId ? [body.shareWithMemberId] : []),
    ];
    if (isAuthEnabled() && req.user && shareTargets.length > 0) {
      incident.sharedWithMemberIds = await normalizeShareTargets(req.user.memberId, shareTargets);
    } else if (shareTargets.length > 0) {
      incident.sharedWithMemberIds = [...new Set(shareTargets.map((id) => id.trim().toUpperCase()))];
    }

    if (Array.isArray(incident.tasks)) {
      incident.tasks = incident.tasks.map((task) => ({
        ...task,
        incidentId: incident.id,
        incidentTitle: incident.title,
      }));
    }

    await withTransaction(async (client) => {
      await queryWithClient(
        client,
        `INSERT INTO incidents (id, data, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3::timestamptz, now())`,
        [incident.id, JSON.stringify(incident), incident.createdAt ?? new Date().toISOString()],
      );
    });

    indexIncident(incident).catch((err) =>
      console.warn(`Vector index failed for ${incident.id}:`, err instanceof Error ? err.message : err),
    );

    recordAlertForIncident(alertText, incident.service, incident.id).catch((err) =>
      console.warn(`Alert index failed for ${incident.id}:`, err instanceof Error ? err.message : err),
    );

    res.status(201).json(incident);
  } catch (err) {
    if (err instanceof Error && (
      err.message.includes('Invalid member ID') ||
      err.message.includes('No user found') ||
      err.message.includes('credentials')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/** Update an existing incident — owner/editor only. */
incidentsRouter.patch('/:id', async (req, res, next) => {
  try {
    const row = await queryOne<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents WHERE id = $1',
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    const existing = row.data as IncidentRecord & { ownerMemberId?: string; ownerName?: string };
    if (isAuthEnabled() && req.user && !canEditIncident(existing, req.user)) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    const incident = normalizeIncidentForSave({
      ...existing,
      ...req.body,
      id: req.params.id,
    } as IncidentRecord & { id: string });

    incident.id = req.params.id;
    if (existing.ownerMemberId) incident.ownerMemberId = existing.ownerMemberId;
    if (existing.ownerName) incident.ownerName = existing.ownerName;

    const rawNotes = (incident as { rawNotes?: string }).rawNotes;
    if (rawNotes?.trim()) {
      assertNotesSafeForProcessing(rawNotes);
      (incident as { rawNotes?: string }).rawNotes = scanAndRedactSecrets(rawNotes).redactedText;
    }

    await withTransaction(async (client) => {
      await queryWithClient(
        client,
        'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
        [incident.id, JSON.stringify(incident)],
      );
    });

    indexIncident(incident).catch((err) =>
      console.warn(`Vector index failed for ${incident.id}:`, err instanceof Error ? err.message : err),
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

    const incident = row.data as { ownerMemberId?: string; status?: string; resolvedAt?: string; createdAt?: string; mttrMinutes?: number };
    if (isAuthEnabled() && req.user && !canEditIncident(incident, req.user)) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    incident.status = req.body.status;

    if (req.body.status === 'RESOLVED' && !incident.resolvedAt) {
      incident.resolvedAt = new Date().toISOString();
      const created = new Date(String(incident.createdAt)).getTime();
      incident.mttrMinutes = Math.round((Date.now() - created) / 60000) || 25;
      markAlertResolvedForIncident(req.params.id).catch((err) =>
        console.warn(`Alert resolve sync failed for ${req.params.id}:`, err instanceof Error ? err.message : err),
      );
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

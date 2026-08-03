import { Router } from 'express';
import { query, queryOne, withTransaction, queryWithClient } from '../db.js';
import { indexIncident, type IncidentRecord } from '../services/vectorService.js';
import { normalizeIncidentForSave } from '../utils/incidentTasks.js';
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
import { createIntakeIncident } from '../services/analysisService.js';
import { markAlertResolvedForIncident } from '../services/alertFatigueService.js';
import { enqueuePostApprovalJobs } from '../services/incidentJobService.js';

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

/** Durable intake — save notes before any AI or embedding work. */
incidentsRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { title, rawNotes, shareWithMemberId } = req.body as {
      title?: string;
      rawNotes?: string;
      shareWithMemberId?: string;
    };

    if (!rawNotes?.trim()) {
      res.status(400).json({ error: 'rawNotes is required' });
      return;
    }

    let incident = await createIntakeIncident(req.user, { title, rawNotes });

    if (shareWithMemberId?.trim() && isAuthEnabled()) {
      const shareTargets = await normalizeShareTargets(req.user.memberId, [shareWithMemberId]);
      incident = {
        ...incident,
        sharedWithMemberIds: shareTargets,
      };
      await query(
        'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
        [incident.id, JSON.stringify(incident)],
      );
    }

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

    const existing = row.data as IncidentRecord & {
      ownerMemberId?: string;
      ownerName?: string;
      analysisStatus?: string;
    };
    if (isAuthEnabled() && req.user && !canEditIncident(existing, req.user)) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    const wasApproved = existing.analysisStatus === 'approved';

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
        'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
        [incident.id, JSON.stringify(incident)],
      );
    });

    const nowApproved = incident.analysisStatus === 'approved';
    if (!wasApproved && nowApproved) {
      await enqueuePostApprovalJobs(incident.id);
    } else if (nowApproved && req.body.reindex === true) {
      indexIncident(incident).catch((err) =>
        console.warn(`Vector re-index failed for ${incident.id}:`, err instanceof Error ? err.message : err),
      );
    }

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

    const incident = row.data as {
      ownerMemberId?: string;
      status?: string;
      resolvedAt?: string;
      createdAt?: string;
      mttrMinutes?: number;
    };
    if (isAuthEnabled() && req.user && !canEditIncident(incident, req.user)) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    incident.status = req.body.status;

    if (req.body.status === 'RESOLVED' && !incident.resolvedAt) {
      incident.resolvedAt = new Date().toISOString();
      const created = new Date(String(incident.createdAt)).getTime();
      incident.mttrMinutes = Math.round((Date.now() - created) / 60000) || 25;
      if (incident.ownerMemberId) {
        markAlertResolvedForIncident(req.params.id, incident.ownerMemberId).catch((err) =>
          console.warn(`Alert resolve sync failed for ${req.params.id}:`, err instanceof Error ? err.message : err),
        );
      }
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

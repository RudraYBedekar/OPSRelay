import { Router } from 'express';
import { query, queryOne, withTransaction, queryWithClient } from '../db.js';
import { indexIncident, type IncidentRecord } from '../services/vectorService.js';
import { normalizeIncidentForSave, type IncidentWithTasks } from '../utils/incidentTasks.js';
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
import { parseTaskStatus } from '../schemas/taskStatus.js';
import { updateIncidentTaskStatus } from '../utils/updateIncidentTaskStatus.js';

export const incidentsRouter = Router();

type StoredIncident = IncidentRecord & IncidentWithTasks & {
  ownerMemberId?: string;
  ownerName?: string;
  analysisStatus?: string;
  rawNotes?: string;
  sharedWithMemberIds?: string[];
};

function asStoredIncident(data: Record<string, unknown>): StoredIncident {
  return data as unknown as StoredIncident;
}

incidentsRouter.get('/', async (req, res, next) => {
  try {
    const rows = await query<{ data: Record<string, unknown>; updated_at: string }>(
      'SELECT data, updated_at FROM incidents WHERE deleted_at IS NULL ORDER BY updated_at DESC',
    );
    const all = rows.map((r) => ({
      ...asStoredIncident(r.data),
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
      'SELECT data FROM incidents WHERE id = $1 AND deleted_at IS NULL',
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

/** Update an existing incident — owner/editor only. Approval must use analysis approve endpoint. */
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

    const existing = asStoredIncident(row.data);
    if (isAuthEnabled() && req.user && !canEditIncident(existing, req.user)) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    const body = req.body as Record<string, unknown>;
    // Approval is only allowed via POST /incidents/:id/analysis/:runId/approve
    if ('analysisStatus' in body) {
      delete body.analysisStatus;
    }

    const merged = {
      ...existing,
      ...body,
      id: req.params.id,
      analysisStatus: existing.analysisStatus,
      ownerMemberId: existing.ownerMemberId,
      ownerName: existing.ownerName,
    } as StoredIncident;

    const incident = normalizeIncidentForSave(merged);

    if (incident.rawNotes?.trim()) {
      assertNotesSafeForProcessing(incident.rawNotes);
      incident.rawNotes = scanAndRedactSecrets(incident.rawNotes).redactedText;
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

    if (body.reindex === true && existing.analysisStatus === 'approved') {
      const record: IncidentRecord = {
        id: incident.id,
        title: incident.title,
        service: incident.service ?? 'general',
        severity: incident.severity,
        summary: incident.summary ?? incident.title,
        rawNotes: incident.rawNotes,
      };
      indexIncident(record).catch((err) =>
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

incidentsRouter.patch('/:id/tasks/:taskId/status', async (req, res, next) => {
  try {
    const status = parseTaskStatus(req.body);
    const task = await updateIncidentTaskStatus(
      req.params.id,
      req.params.taskId,
      status,
      req.user,
    );
    res.json(task);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Task not found' });
      return;
    }
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

/** Soft-delete — hides from dashboard; row and evidence remain in the database. */
incidentsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (isAuthEnabled() && !req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const row = await queryOne<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id],
    );
    if (!row) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    const incident = asStoredIncident(row.data);
    if (isAuthEnabled() && req.user && !canEditIncident(incident, req.user)) {
      res.status(404).json({ error: `Incident ${req.params.id} not found` });
      return;
    }

    await query(
      `UPDATE incidents
       SET deleted_at = now(), deleted_by_member_id = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id, req.user?.memberId ?? null],
    );

    res.json({ deleted: true, id: req.params.id, retained: true });
  } catch (err) {
    next(err);
  }
});

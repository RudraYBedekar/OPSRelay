import { Router } from 'express';
import {
  startAnalysisRun,
  getLatestRun,
  approveAnalysisRun,
} from '../services/analysisService.js';
import { getJobsForIncident } from '../services/incidentJobService.js';
import {
  canEditIncident,
  canViewIncident,
  getGrantedOwnerMemberIds,
} from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';
import { queryOne } from '../db.js';

export const analysisRouter = Router();

async function loadIncident(id: string) {
  const row = await queryOne<{ data: Record<string, unknown> }>(
    'SELECT data FROM incidents WHERE id = $1',
    [id],
  );
  return row?.data;
}

analysisRouter.post('/:id/analysis', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const idempotencyKey = req.header('Idempotency-Key')?.trim();
    if (!idempotencyKey) {
      res.status(400).json({ error: 'Idempotency-Key header is required' });
      return;
    }
    const incident = await loadIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    if (isAuthEnabled() && !canEditIncident(incident as { ownerMemberId?: string }, req.user)) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const run = await startAnalysisRun(req.params.id, req.user, idempotencyKey);
    res.json(run);
  } catch (err) {
    next(err);
  }
});

analysisRouter.get('/:id/analysis/current', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const incident = await loadIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    if (isAuthEnabled()) {
      const granted = new Set(await getGrantedOwnerMemberIds(req.user.memberId));
      if (!canViewIncident(incident as { ownerMemberId?: string; sharedWithMemberIds?: string[] }, req.user, granted)) {
        res.status(404).json({ error: 'Incident not found' });
        return;
      }
    }
    const ownerId = String(incident.ownerMemberId ?? req.user.memberId);
    const run = await getLatestRun(req.params.id, ownerId);
    const jobs = await getJobsForIncident(req.params.id);
    res.json({ run, jobs, analysisStatus: incident.analysisStatus ?? 'not_started' });
  } catch (err) {
    next(err);
  }
});

analysisRouter.post('/:id/analysis/:runId/approve', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const incident = await loadIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    if (isAuthEnabled() && !canEditIncident(incident as { ownerMemberId?: string }, req.user)) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const updated = await approveAnalysisRun(
      req.params.id,
      req.params.runId,
      req.user,
      req.body as Record<string, unknown>,
    );
    res.json(updated);
  } catch (err) {
    if ((err as { status?: number }).status === 409) {
      res.status(409).json({ error: 'Analysis already approved' });
      return;
    }
    next(err);
  }
});

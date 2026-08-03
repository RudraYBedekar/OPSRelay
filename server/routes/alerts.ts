import { Router } from 'express';
import { queryOne } from '../db.js';
import {
  getAlertStatsForIncident,
  getAlertByIdForOwner,
  markAlertAsNoise,
  markAlertDistinct,
} from '../services/alertFatigueService.js';
import {
  canViewAlertForIncident,
  canManageAlertForIncident,
  getGrantedOwnerMemberIds,
} from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';

export const alertsRouter = Router();

async function loadIncidentForAuth(incidentId: string) {
  const row = await queryOne<{ data: Record<string, unknown> }>(
    'SELECT data FROM incidents WHERE id = $1',
    [incidentId],
  );
  return row?.data as { ownerMemberId?: string; sharedWithMemberIds?: string[] } | undefined;
}

async function assertViewIncident(incidentId: string, viewer: { memberId: string; role: string } | undefined) {
  const incident = await loadIncidentForAuth(incidentId);
  if (!incident) return { ok: false as const, incident: undefined };
  if (!isAuthEnabled() || !viewer) return { ok: true as const, incident };
  const granted = new Set(await getGrantedOwnerMemberIds(viewer.memberId));
  if (!canViewAlertForIncident(incident, viewer, granted)) {
    return { ok: false as const, incident: undefined };
  }
  return { ok: true as const, incident };
}

async function assertEditIncident(incidentId: string, viewer: { memberId: string; role: string } | undefined) {
  const incident = await loadIncidentForAuth(incidentId);
  if (!incident) return { ok: false as const, incident: undefined, ownerMemberId: undefined };
  if (!isAuthEnabled() || !viewer) {
    return { ok: true as const, incident, ownerMemberId: String(incident.ownerMemberId ?? '') };
  }
  if (!canManageAlertForIncident(incident, viewer)) {
    return { ok: false as const, incident: undefined, ownerMemberId: undefined };
  }
  return { ok: true as const, incident, ownerMemberId: String(incident.ownerMemberId ?? viewer.memberId) };
}

alertsRouter.get('/incident/:incidentId/stats', async (req, res, next) => {
  try {
    const check = await assertViewIncident(req.params.incidentId, req.user);
    if (!check.ok || !check.incident?.ownerMemberId) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const stats = await getAlertStatsForIncident(req.params.incidentId, check.incident.ownerMemberId);
    res.json(stats ?? { suppressedCount: 0, summaryMessage: null });
  } catch (err) {
    next(err);
  }
});

alertsRouter.post('/:alertId/mark-noise', async (req, res, next) => {
  try {
    if (!req.user?.memberId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const alert = await getAlertByIdForOwner(req.params.alertId, req.user.memberId);
    if (!alert?.linkedIncidentId) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const check = await assertEditIncident(alert.linkedIncidentId, req.user);
    if (!check.ok) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const updated = await markAlertAsNoise(req.params.alertId, check.ownerMemberId!);
    if (!updated) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    res.json({ alertId: req.params.alertId, status: 'noise' });
  } catch (err) {
    next(err);
  }
});

alertsRouter.post('/:alertId/override-distinct', async (req, res, next) => {
  try {
    if (!req.user?.memberId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const alert = await getAlertByIdForOwner(req.params.alertId, req.user.memberId);
    if (!alert?.linkedIncidentId) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const check = await assertEditIncident(alert.linkedIncidentId, req.user);
    if (!check.ok) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const updated = await markAlertDistinct(req.params.alertId, check.ownerMemberId!);
    if (!updated) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    res.json({
      alertId: req.params.alertId,
      message: 'Marked as actually distinct.',
      forceDistinct: true,
    });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import {
  evaluateAlert,
  getAlertStatsForIncident,
  getAlertById,
  markAlertAsNoise,
  buildAlertText,
} from '../services/alertFatigueService.js';

export const alertsRouter = Router();

alertsRouter.post('/evaluate', async (req, res, next) => {
  try {
    const { alertText, service, title, summary, rawNotes, forceDistinct, overrideAlertId } = req.body as {
      alertText?: string;
      service?: string;
      title?: string;
      summary?: string;
      rawNotes?: string;
      forceDistinct?: boolean;
      overrideAlertId?: string;
    };

    const text = alertText?.trim() || buildAlertText({ title, summary, rawNotes });
    const svc = service?.trim();

    if (!text || !svc) {
      res.status(400).json({ error: 'alertText (or title/summary) and service are required' });
      return;
    }

    res.json(await evaluateAlert(text, svc, { forceDistinct, overrideAlertId }));
  } catch (err) {
    next(err);
  }
});

alertsRouter.get('/incident/:incidentId/stats', async (req, res, next) => {
  try {
    const stats = await getAlertStatsForIncident(req.params.incidentId);
    res.json(stats ?? { suppressedCount: 0, summaryMessage: null });
  } catch (err) {
    next(err);
  }
});

alertsRouter.post('/:alertId/mark-noise', async (req, res, next) => {
  try {
    const alert = await getAlertById(req.params.alertId);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    await markAlertAsNoise(req.params.alertId);
    res.json({ alertId: req.params.alertId, status: 'noise' });
  } catch (err) {
    next(err);
  }
});

alertsRouter.post('/:alertId/override-distinct', async (req, res, next) => {
  try {
    const alert = await getAlertById(req.params.alertId);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    const { query } = await import('../db.js');
    await query(
      `UPDATE alert_embeddings SET distinct_override = true, status = 'active', last_seen = now() WHERE id = $1`,
      [req.params.alertId],
    );
    res.json({
      alertId: req.params.alertId,
      message: 'Marked as actually distinct. You can now create a new incident.',
      forceDistinct: true,
    });
  } catch (err) {
    next(err);
  }
});

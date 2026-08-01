import { Router } from 'express';
import {
  launchCommander,
  getWarRoom,
  listActiveWarRooms,
  recordUserAction,
  acknowledgeAssignment,
  resolveCommander,
  getReplay,
  checkAndEscalate,
} from '../services/commanderService.js';
import {
  canViewIncident,
  getGrantedOwnerMemberIds,
} from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';
import type { AuthUser } from '../services/authService.js';
import { queryOne } from '../db.js';

export const commanderRouter = Router();

async function assertIncidentAccess(
  incidentId: string,
  user?: AuthUser,
): Promise<Record<string, unknown>> {
  const row = await queryOne<{ data: Record<string, unknown> }>(
    'SELECT data FROM incidents WHERE id = $1',
    [incidentId],
  );
  if (!row) throw Object.assign(new Error(`Incident ${incidentId} not found`), { status: 404 });

  if (isAuthEnabled() && user) {
    const granted = new Set(await getGrantedOwnerMemberIds(user.memberId));
    if (!canViewIncident(row.data, user, granted)) {
      throw Object.assign(new Error(`Incident ${incidentId} not found`), { status: 404 });
    }
  }

  return row.data;
}

commanderRouter.get('/', async (_req, res, next) => {
  try {
    const rooms = await listActiveWarRooms();
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

commanderRouter.get('/:incidentId/replay', async (req, res, next) => {
  try {
    await assertIncidentAccess(req.params.incidentId, req.user);
    const replay = await getReplay(req.params.incidentId);
    res.json(replay);
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
});

commanderRouter.get('/:incidentId', async (req, res, next) => {
  try {
    await assertIncidentAccess(req.params.incidentId, req.user);
    const warRoom = await getWarRoom(req.params.incidentId);
    res.json(warRoom);
  } catch (err) {
    if ((err as Error).message.includes('No commander session')) {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    if ((err as { status?: number }).status === 404) {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
});

commanderRouter.post('/:incidentId/launch', async (req, res, next) => {
  try {
    await assertIncidentAccess(req.params.incidentId, req.user);
    const warRoom = await launchCommander(req.params.incidentId, req.user);
    res.json(warRoom);
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    if (err instanceof Error && err.message.includes('only activates')) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

commanderRouter.post('/:incidentId/actions', async (req, res, next) => {
  try {
    await assertIncidentAccess(req.params.incidentId, req.user);
    const { title, description, outcome } = req.body as {
      title?: string;
      description?: string;
      outcome?: string;
    };
    if (!title?.trim()) {
      res.status(400).json({ error: 'Action title is required' });
      return;
    }

    const actor = req.user?.name ?? 'Engineer';
    const result = await recordUserAction(req.params.incidentId, {
      title: title.trim(),
      description,
      actor,
      outcome,
    });
    res.json(result);
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
});

commanderRouter.post('/:incidentId/acknowledge', async (req, res, next) => {
  try {
    await assertIncidentAccess(req.params.incidentId, req.user);
    const memberId = req.user?.memberId ?? req.body.memberId;
    if (!memberId) {
      res.status(400).json({ error: 'Member ID required' });
      return;
    }
    await acknowledgeAssignment(req.params.incidentId, memberId);
    res.json(await getWarRoom(req.params.incidentId));
  } catch (err) {
    next(err);
  }
});

commanderRouter.post('/:incidentId/escalate', async (req, res, next) => {
  try {
    await assertIncidentAccess(req.params.incidentId, req.user);
    await checkAndEscalate(req.params.incidentId);
    res.json(await getWarRoom(req.params.incidentId));
  } catch (err) {
    next(err);
  }
});

commanderRouter.post('/:incidentId/resolve', async (req, res, next) => {
  try {
    await assertIncidentAccess(req.params.incidentId, req.user);
    const warRoom = await resolveCommander(req.params.incidentId);
    res.json(warRoom);
  } catch (err) {
    next(err);
  }
});

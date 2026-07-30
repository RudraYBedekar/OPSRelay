import { Router } from 'express';
import {
  createAccessRequest,
  listGrantsForOwner,
  listIncomingRequests,
  listOutgoingRequests,
  respondToAccessRequest,
} from '../services/incidentAccessService.js';

export const accessRouter = Router();

accessRouter.post('/request', async (req, res, next) => {
  try {
    const { ownerMemberId, message } = req.body as { ownerMemberId?: string; message?: string };
    if (!ownerMemberId?.trim()) {
      res.status(400).json({ error: 'Owner member ID is required' });
      return;
    }
    const request = await createAccessRequest(req.user!, ownerMemberId, message);
    res.status(201).json(request);
  } catch (err) {
    if (err instanceof Error && (
      err.message.includes('Invalid') ||
      err.message.includes('cannot') ||
      err.message.includes('already') ||
      err.message.includes('No user')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

accessRouter.get('/incoming', async (req, res, next) => {
  try {
    res.json(await listIncomingRequests(req.user!.memberId));
  } catch (err) {
    next(err);
  }
});

accessRouter.get('/outgoing', async (req, res, next) => {
  try {
    res.json(await listOutgoingRequests(req.user!.memberId));
  } catch (err) {
    next(err);
  }
});

accessRouter.get('/grants', async (req, res, next) => {
  try {
    res.json(await listGrantsForOwner(req.user!.memberId));
  } catch (err) {
    next(err);
  }
});

accessRouter.post('/requests/:id/approve', async (req, res, next) => {
  try {
    res.json(await respondToAccessRequest(req.params.id, req.user!.memberId, true));
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes('already handled')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

accessRouter.post('/requests/:id/reject', async (req, res, next) => {
  try {
    res.json(await respondToAccessRequest(req.params.id, req.user!.memberId, false));
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes('already handled')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

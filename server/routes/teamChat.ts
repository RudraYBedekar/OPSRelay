import { Router } from 'express';
import type { AuthUser } from '../services/authService.js';
import {
  listChatsForUser,
  listChatMembers,
  getOrCreateChat,
  getChatDetail,
  sendChatMessage,
  inviteGuestToChat,
  removeGuestFromChat,
  type GuestDuration,
} from '../services/teamChatService.js';
import { isAuthEnabled } from '../config/auth.js';

export const teamChatRouter = Router();

const GUEST_DURATIONS: GuestDuration[] = [5, 15, 30, 60];

function requireUser(req: { user?: AuthUser }): AuthUser {
  if (!isAuthEnabled() || !req.user) {
    throw Object.assign(new Error('Authentication required'), { status: 401 });
  }
  return req.user;
}

teamChatRouter.get('/members', async (req, res, next) => {
  try {
    const user = requireUser(req);
    res.json(await listChatMembers(user.memberId));
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
});

teamChatRouter.get('/', async (req, res, next) => {
  try {
    const user = requireUser(req);
    res.json(await listChatsForUser(user));
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
});

teamChatRouter.post('/', async (req, res, next) => {
  try {
    const user = requireUser(req);
    const { memberId } = req.body as { memberId?: string };
    if (!memberId?.trim()) {
      res.status(400).json({ error: 'Recipient member ID is required' });
      return;
    }
    res.json(await getOrCreateChat(user, memberId));
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }
    if (err instanceof Error && (
      err.message.includes('Invalid') ||
      err.message.includes('No user') ||
      err.message.includes('cannot start')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

teamChatRouter.get('/:chatId', async (req, res, next) => {
  try {
    const user = requireUser(req);
    res.json(await getChatDetail(req.params.chatId, user.memberId));
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }
    if (err instanceof Error && err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

teamChatRouter.post('/:chatId/messages', async (req, res, next) => {
  try {
    const user = requireUser(req);
    const { text, imageData } = req.body as { text?: string; imageData?: string };
    if (!text?.trim() && !imageData?.trim()) {
      res.status(400).json({ error: 'Message text or image is required' });
      return;
    }
    const message = await sendChatMessage(
      req.params.chatId,
      user,
      text?.trim() ?? '',
      imageData?.trim(),
    );
    res.json(message);
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }
    if (err instanceof Error && (
      err.message.includes('not found') ||
      err.message.includes('access') ||
      err.message.includes('empty') ||
      err.message.includes('Image')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

teamChatRouter.post('/:chatId/guests', async (req, res, next) => {
  try {
    const user = requireUser(req);
    const { memberId, durationMinutes } = req.body as {
      memberId?: string;
      durationMinutes?: GuestDuration;
    };
    if (!memberId?.trim()) {
      res.status(400).json({ error: 'Guest member ID is required' });
      return;
    }
    if (!durationMinutes || !GUEST_DURATIONS.includes(durationMinutes)) {
      res.status(400).json({ error: 'durationMinutes must be 5, 15, 30, or 60' });
      return;
    }
    res.json(await inviteGuestToChat(req.params.chatId, user, memberId, durationMinutes));
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }
    if (err instanceof Error && (
      err.message.includes('Invalid') ||
      err.message.includes('No user') ||
      err.message.includes('Only chat') ||
      err.message.includes('Guest must') ||
      err.message.includes('already')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

teamChatRouter.delete('/:chatId/guests/:guestId', async (req, res, next) => {
  try {
    const user = requireUser(req);
    res.json(await removeGuestFromChat(req.params.chatId, user, req.params.guestId));
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }
    if (err instanceof Error && (
      err.message.includes('not found') ||
      err.message.includes('Only chat') ||
      err.message.includes('No active guest')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

teamChatRouter.post('/:chatId/guests/remove', async (req, res, next) => {
  try {
    const user = requireUser(req);
    const { guestId } = req.body as { guestId?: string };
    res.json(await removeGuestFromChat(req.params.chatId, user, guestId));
  } catch (err) {
    if ((err as { status?: number }).status === 401) {
      res.status(401).json({ error: (err as Error).message });
      return;
    }
    if (err instanceof Error && (
      err.message.includes('not found') ||
      err.message.includes('Only chat') ||
      err.message.includes('No active guest')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

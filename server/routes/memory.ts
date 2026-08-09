import { Router } from 'express';
import { query } from '../db.js';
import { isBedrockConfigured } from '../config/bedrock.js';
import { runAgent } from '../services/agentService.js';
import { getEmbeddingCount } from '../services/vectorService.js';
import { chatBelongsToUser, saveAgentChatToMemory } from '../services/chatPersistence.js';
import { filterIncidentsForUser } from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';

export const memoryRouter = Router();

memoryRouter.get('/', async (req, res, next) => {
  try {
    const rows = await query<{ data: { ownerMemberId?: string } }>(
      'SELECT data FROM memory_chats WHERE hidden_at IS NULL ORDER BY created_at ASC',
    );
    const memberId = req.user?.memberId;
    const chats = rows
      .map((r) => r.data)
      .filter((data) => chatBelongsToUser(data, memberId));
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

memoryRouter.get('/status', async (_req, res, next) => {
  try {
    const embeddingCount = await getEmbeddingCount();
    res.json({
      bedrockEnabled: isBedrockConfigured(),
      embeddingCount,
      searchMode: embeddingCount > 0 ? (isBedrockConfigured() ? 'bedrock-vector' : 'local-vector') : 'keyword',
    });
  } catch (err) {
    next(err);
  }
});

memoryRouter.post('/query', async (req, res, next) => {
  try {
    const { queryText } = req.body as { queryText: string };
    if (!queryText?.trim()) {
      res.status(400).json({ error: 'Query cannot be empty' });
      return;
    }

    const result = await runAgent(queryText, undefined, req.user);

    const incidentRows = await query<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents',
    );
    const allIncidents = incidentRows.map((r) => r.data);
    const incidents = isAuthEnabled() && req.user
      ? await filterIncidentsForUser(allIncidents, req.user)
      : allIncidents;

    const matches = result.similarIncidents.map((m) => {
      const inc = incidents.find((i) => i.id === m.id);
      return {
        id: m.id,
        title: m.title,
        similarityScore: m.similarityScore,
        service: m.service,
        resolvedDuration: inc?.mttrMinutes ? `${inc.mttrMinutes} mins` : undefined,
        keyTakeaway: m.keyTakeaway,
        citations: [
          `Incident ${m.id}`,
          result.mode === 'bedrock' ? 'Vector search (Bedrock embeddings)' : result.mode === 'local' ? 'Vector search (local)' : 'Keyword search',
        ],
        severity: inc?.severity,
        resolvedDate: inc?.resolvedAt ? String(inc.resolvedAt).split('T')[0] : undefined,
      };
    });

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const ownerMemberId = isAuthEnabled() && req.user ? req.user.memberId : undefined;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: timeStr,
      ownerMemberId,
    };
    const assistantMsg = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: result.answer,
      timestamp: timeStr,
      matchedIncidents: matches,
      agentMode: result.mode,
      ownerMemberId,
      suggestedRunbooks: [],
    };

    await query(
      'INSERT INTO memory_chats (id, data) VALUES ($1, $2::jsonb), ($3, $4::jsonb)',
      [userMsg.id, JSON.stringify(userMsg), assistantMsg.id, JSON.stringify(assistantMsg)],
    );

    res.json(assistantMsg);
  } catch (err) {
    next(err);
  }
});

memoryRouter.delete('/', async (req, res, next) => {
  try {
    if (isAuthEnabled() && req.user) {
      await query(
        `UPDATE memory_chats
         SET hidden_at = now(), hidden_by_member_id = $1
         WHERE hidden_at IS NULL
           AND data->>'ownerMemberId' = $1`,
        [req.user.memberId],
      );
    } else {
      await query(
        `UPDATE memory_chats SET hidden_at = now() WHERE hidden_at IS NULL`,
      );
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

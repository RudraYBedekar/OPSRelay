import { Router } from 'express';
import { runAgent, getAgentStatus } from '../services/agentService.js';
import { embedAllIncidentsFromDb, getEmbeddingCount } from '../services/vectorService.js';
import { saveAgentChatToMemory } from '../services/chatPersistence.js';

export const agentRouter = Router();

agentRouter.get('/status', async (_req, res, next) => {
  try {
    res.json(await getAgentStatus());
  } catch (err) {
    next(err);
  }
});

agentRouter.post('/index', async (_req, res, next) => {
  try {
    const chunks = await embedAllIncidentsFromDb();
    const total = await getEmbeddingCount();
    res.json({ indexed: chunks, totalEmbeddings: total, message: 'Vector index rebuilt' });
  } catch (err) {
    next(err);
  }
});

agentRouter.post('/run', async (req, res, next) => {
  try {
    const { query: queryText, incidentId, saveChat = true } = req.body as {
      query?: string;
      incidentId?: string;
      saveChat?: boolean;
    };

    if (!queryText?.trim()) {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    const result = await runAgent(queryText, incidentId, req.user);

    if (saveChat !== false) {
      try {
        await saveAgentChatToMemory(queryText, incidentId, result, req.user);
      } catch (err) {
        console.warn('Failed to save chat to memory_chats:', err instanceof Error ? err.message : err);
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** @deprecated use POST /run */
agentRouter.post('/respond', async (req, res, next) => {
  try {
    const { query: queryText, incidentId } = req.body as {
      query?: string;
      incidentId?: string;
    };
    if (!queryText?.trim()) {
      res.status(400).json({ error: 'query is required' });
      return;
    }
    const result = await runAgent(queryText, incidentId, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

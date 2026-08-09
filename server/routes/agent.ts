import { Router } from 'express';
import { runAgent, getAgentStatus } from '../services/agentService.js';
import { embedAllIncidentsFromDb, getEmbeddingCount } from '../services/vectorService.js';
import { saveAgentChatToMemory } from '../services/chatPersistence.js';
import { canReindexCorpus } from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';

export const agentRouter = Router();

agentRouter.get('/status', async (_req, res, next) => {
  try {
    res.json(await getAgentStatus());
  } catch (err) {
    next(err);
  }
});

agentRouter.post('/index', async (req, res, next) => {
  try {
    if (isAuthEnabled() && !canReindexCorpus(req.user)) {
      res.status(403).json({ error: 'Only administrators may rebuild the vector index.' });
      return;
    }
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

    let savedUserMessageId: string | undefined;
    if (saveChat !== false) {
      try {
        const saved = await saveAgentChatToMemory(queryText, incidentId, result, req.user);
        savedUserMessageId = saved.userMessageId;
      } catch (err) {
        console.warn('Failed to save chat to memory_chats:', err instanceof Error ? err.message : err);
      }
    }

    res.json({ ...result, savedUserMessageId });
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

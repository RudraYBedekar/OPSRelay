import { Router } from 'express';
import { getMcpHealth, mcpConfig } from '../config/mcp.js';
import { probeManagedMcpConnection } from '../mcp/mcpClientFactory.js';
import { runInvestigation } from '../services/investigatorService.js';
import { saveInvestigatorChatToMemory } from '../services/chatPersistence.js';
import { canUseInvestigator } from '../services/incidentAccessService.js';
import { isAuthEnabled } from '../config/auth.js';

export const investigatorRouter = Router();

investigatorRouter.get('/status', async (req, res) => {
  if (isAuthEnabled() && req.user && !canUseInvestigator(req.user)) {
    res.status(403).json({ error: 'Investigator access denied' });
    return;
  }
  if (mcpConfig.mode === 'managed_mcp') {
    await probeManagedMcpConnection();
  }
  res.json(getMcpHealth());
});

investigatorRouter.post('/query', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const { question, incidentId, saveChat = true } = req.body as {
      question?: string;
      incidentId?: string;
      saveChat?: boolean;
    };
    if (!question?.trim()) {
      res.status(400).json({ error: 'question is required' });
      return;
    }
    if (question.length > 2000) {
      res.status(400).json({ error: 'question too long' });
      return;
    }
    const result = await runInvestigation(question.trim(), req.user, incidentId?.trim());

    let savedUserMessageId: string | undefined;
    if (saveChat !== false) {
      try {
        const saved = await saveInvestigatorChatToMemory(
          question.trim(),
          incidentId?.trim(),
          result.answer,
          result.citations,
          req.user,
        );
        savedUserMessageId = saved.userMessageId;
      } catch (err) {
        console.warn('Failed to save MCP chat to memory_chats:', err instanceof Error ? err.message : err);
      }
    }

    res.json({ ...result, savedUserMessageId });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status) {
      res.status(status).json({ error: err instanceof Error ? err.message : 'Investigation failed' });
      return;
    }
    next(err);
  }
});

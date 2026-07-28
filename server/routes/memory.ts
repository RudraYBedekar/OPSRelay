import { Router } from 'express';
import { query } from '../db.js';
import { isBedrockConfigured } from '../config/bedrock.js';
import { runAgent } from '../services/agentService.js';
import { getEmbeddingCount } from '../services/vectorService.js';

export const memoryRouter = Router();

memoryRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query<{ data: unknown }>(
      'SELECT data FROM memory_chats ORDER BY created_at ASC',
    );
    res.json(rows.map((r) => r.data));
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

    const { answer, similarIncidents, mode } = await runAgent(queryText);

    const incidentRows = await query<{ data: Record<string, unknown> }>(
      'SELECT data FROM incidents',
    );
    const incidents = incidentRows.map((r) => r.data);

    const matches = similarIncidents.map((m) => {
      const inc = incidents.find((i) => i.id === m.id);
      return {
        id: m.id,
        title: m.title,
        similarityScore: m.similarityScore,
        service: m.service,
        resolvedDuration: inc?.mttrMinutes ? `${inc.mttrMinutes} mins` : '30 mins',
        keyTakeaway: m.keyTakeaway,
        citations: [
          `Vector chunk: ${m.id}`,
          `Postmortem #${m.id}-PM`,
          mode === 'bedrock' ? 'Bedrock Agent + CRDB Vector' : mode === 'local' ? 'Local Vector + CRDB' : 'Keyword fallback',
        ],
        severity: inc?.severity ?? 'SEV-2',
        resolvedDate: inc?.resolvedAt ? String(inc.resolvedAt).split('T')[0] : '2026-07-26',
      };
    });

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: queryText, timestamp: timeStr };
    const assistantMsg = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: answer,
      timestamp: timeStr,
      matchedIncidents: matches,
      suggestedRunbooks: matches[0]
        ? [
            {
              title: `${matches[0].service} Diagnostic Runbook`,
              url: `https://internal-wiki.opsrelay.io/runbooks/${matches[0].service}`,
              codeSnippet: `OpsRelay-cli analyze --service ${matches[0].service} --timeframe 1h`,
            },
          ]
        : [],
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

memoryRouter.delete('/', async (_req, res, next) => {
  try {
    await query('DELETE FROM memory_chats');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

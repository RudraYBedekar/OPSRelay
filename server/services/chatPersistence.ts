import { query } from '../db.js';
import type { AgentResult } from '../services/agentService.js';

/** Persist one Ask AI exchange (user + assistant) to memory_chats. */
export async function saveAgentChatToMemory(
  queryText: string,
  incidentId: string | undefined,
  result: AgentResult,
): Promise<void> {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ts = Date.now();

  const userMsg = {
    id: `user-${ts}`,
    sender: 'user' as const,
    text: queryText.trim(),
    timestamp: timeStr,
    linkedIncidentId: incidentId,
  };

  const matchedIncidents = result.similarIncidents.map((m) => ({
    id: m.id,
    title: m.title,
    similarityScore: m.similarityScore,
    service: m.service,
    resolvedDuration: '—',
    keyTakeaway: m.keyTakeaway,
    citations: [`Vector match · ${m.similarityScore}%`, `Mode: ${result.mode}`],
    severity: (m.severity ?? 'SEV-2') as 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3',
    resolvedDate: new Date().toISOString().split('T')[0],
  }));

  const assistantMsg = {
    id: `msg-${ts}`,
    sender: 'assistant' as const,
    text: result.answer,
    timestamp: timeStr,
    agentMode: result.mode,
    linkedIncidentId: incidentId,
    matchedIncidents,
  };

  await query(
    `INSERT INTO memory_chats (id, data) VALUES ($1, $2::jsonb), ($3, $4::jsonb)`,
    [userMsg.id, JSON.stringify(userMsg), assistantMsg.id, JSON.stringify(assistantMsg)],
  );
}

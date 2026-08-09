import { query } from '../db.js';
import type { AgentResult } from '../services/agentService.js';
import type { AuthUser } from './authService.js';
import { isAuthEnabled } from '../config/auth.js';

/** Persist one Ask AI exchange (user + assistant) to memory_chats. */
export async function saveAgentChatToMemory(
  queryText: string,
  incidentId: string | undefined,
  result: AgentResult,
  owner?: AuthUser,
): Promise<{ userMessageId: string; assistantMessageId: string }> {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ts = Date.now();
  const ownerMemberId = isAuthEnabled() && owner ? owner.memberId : undefined;

  const userMsg = {
    id: `user-${ts}`,
    sender: 'user' as const,
    text: queryText.trim(),
    timestamp: timeStr,
    linkedIncidentId: incidentId,
    ownerMemberId,
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
    ownerMemberId,
  };

  await query(
    `INSERT INTO memory_chats (id, data) VALUES ($1, $2::jsonb), ($3, $4::jsonb)`,
    [userMsg.id, JSON.stringify(userMsg), assistantMsg.id, JSON.stringify(assistantMsg)],
  );

  return { userMessageId: userMsg.id, assistantMessageId: assistantMsg.id };
}

/** Persist one MCP investigator exchange to memory_chats. */
export async function saveInvestigatorChatToMemory(
  queryText: string,
  incidentId: string | undefined,
  answer: string,
  citations: Array<Record<string, unknown>>,
  owner?: AuthUser,
): Promise<{ userMessageId: string; assistantMessageId: string }> {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ts = Date.now();
  const ownerMemberId = isAuthEnabled() && owner ? owner.memberId : undefined;

  const userMsg = {
    id: `user-${ts}`,
    sender: 'user' as const,
    text: queryText.trim(),
    timestamp: timeStr,
    linkedIncidentId: incidentId,
    ownerMemberId,
  };

  const assistantMsg = {
    id: `msg-${ts}`,
    sender: 'assistant' as const,
    text: answer,
    timestamp: timeStr,
    agentMode: 'mcp',
    linkedIncidentId: incidentId,
    mcpCitations: citations,
    ownerMemberId,
  };

  await query(
    `INSERT INTO memory_chats (id, data) VALUES ($1, $2::jsonb), ($3, $4::jsonb)`,
    [userMsg.id, JSON.stringify(userMsg), assistantMsg.id, JSON.stringify(assistantMsg)],
  );

  return { userMessageId: userMsg.id, assistantMessageId: assistantMsg.id };
}

export function chatBelongsToUser(
  data: { ownerMemberId?: string },
  memberId: string | undefined,
): boolean {
  if (!isAuthEnabled() || !memberId) return true;
  if (!data.ownerMemberId) return false;
  return data.ownerMemberId === memberId;
}

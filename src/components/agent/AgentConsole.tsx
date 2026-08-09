import React, { useState, useEffect, useRef } from 'react';
import { CircleNotch, PaperPlaneTilt, Sparkle, Robot, User, Database } from '@phosphor-icons/react';
import { ChatMarkdown } from './ChatMarkdown';
import { ChatSidebar, buildChatThreads, type ChatThread } from './ChatSidebar';
import { MemorySourceCard } from './MemorySourceCard';
import { McpCitationCard } from './McpCitationCard';
import type { McpCitation } from '../../types/investigator';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useToast } from '../common/Toast';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import type { Incident, MemoryChatMessage, RelatedIncident } from '../../types/incident';

interface AgentRunResult {
  answer: string;
  similarIncidents: Array<{
    id: string;
    title: string;
    service: string;
    similarityScore: number;
    keyTakeaway: string;
    severity?: string;
  }>;
  mode: string;
}

interface LiveMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  similarIncidents?: AgentRunResult['similarIncidents'];
  mcpCitations?: McpCitation[];
  linkedIncidentId?: string;
}

const PROMPTS = [
  'What fixed similar payment-api webhook failures?',
  'Have we seen payment-api connection pool saturation before?',
  'Recommended steps for a SEV-1 payment-api outage',
];

interface AgentConsoleProps {
  incidents: Incident[];
  onInspectIncident: (id: string) => void;
}

function threadToMessages(thread: ChatThread): LiveMessage[] {
  const out: LiveMessage[] = [];
  for (const msg of thread.messages) {
    if (msg.sender === 'user') {
      out.push({
        id: msg.id,
        role: 'user',
        content: msg.text,
        linkedIncidentId: msg.linkedIncidentId,
      });
    } else {
      out.push({
        id: msg.id,
        role: 'assistant',
        content: msg.text,
        mode: msg.agentMode,
        linkedIncidentId: msg.linkedIncidentId,
        similarIncidents: msg.matchedIncidents?.map((m) => ({
          id: m.id,
          title: m.title,
          service: m.service,
          similarityScore: m.similarityScore,
          keyTakeaway: m.keyTakeaway,
          severity: m.severity,
        })),
      });
    }
  }
  return out;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({ incidents, onInspectIncident }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const [saveChat, setSaveChat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [chatHistory, setChatHistory] = useState<MemoryChatMessage[]>([]);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [agentMode, setAgentMode] = useState<'memory' | 'mcp'>('memory');
  const scrollRef = useRef<HTMLDivElement>(null);

  const threads = buildChatThreads(chatHistory);

  const loadHistory = async () => {
    try {
      setChatHistory(await apiService.getMemoryChats());
    } catch {
      setChatHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    setLoadingHistory(true);
    setChatHistory([]);
    setMessages([]);
    setActiveThreadId(null);
    void loadHistory();
  }, [user?.memberId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const startNewChat = () => {
    setMessages([]);
    setActiveThreadId(null);
    setError(null);
    setQuery('');
  };

  const selectThread = (thread: ChatThread) => {
    setMessages(threadToMessages(thread));
    setActiveThreadId(thread.id);
    setError(null);
  };

  const run = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q || loading) return;

    const userMsg: LiveMessage = {
      id: `live-user-${Date.now()}`,
      role: 'user',
      content: q,
      linkedIncidentId: incidentId || undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);
    setError(null);
    setActiveThreadId(null);

    try {
      if (agentMode === 'mcp') {
        const result = await apiService.queryInvestigator(q, incidentId || undefined);
        const assistantMsg: LiveMessage = {
          id: `live-assistant-${Date.now()}`,
          role: 'assistant',
          content: result.answer,
          mode: 'mcp',
          mcpCitations: result.citations,
          linkedIncidentId: incidentId || undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const agentResult = await apiService.runAgent(q, incidentId || undefined, saveChat) as AgentRunResult;
        const assistantMsg: LiveMessage = {
          id: `live-assistant-${Date.now()}`,
          role: 'assistant',
          content: agentResult.answer,
          mode: agentResult.mode,
          similarIncidents: agentResult.similarIncidents,
          linkedIncidentId: incidentId || undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (saveChat) {
          await loadHistory();
          toast('Saved to chat history', 'success');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      toast('Ask AI request failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await apiService.clearMemoryChats();
      setChatHistory([]);
      startNewChat();
      toast('Chat history hidden — data retained in database', 'success');
    } catch {
      toast('Failed to clear history', 'error');
    }
  };

  return (
    <>
      <div className="flex h-[calc(100vh-10.5rem)] min-h-[520px] overflow-hidden rounded-xl border border-ops-border bg-white shadow-sm">
        <ChatSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onNewChat={startNewChat}
          onSelectThread={selectThread}
          onClearHistory={() => setConfirmClear(true)}
          usingCrdb={apiService.isUsingCrdb()}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ops-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkle size={16} weight="regular" className="text-brand" aria-hidden />
              <span className="text-sm font-semibold text-ops-text">OpsRelay AI</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={agentMode}
                onChange={(e) => setAgentMode(e.target.value as 'memory' | 'mcp')}
                className="ops-input max-w-[140px] py-1.5 text-xs"
                aria-label="Agent mode"
              >
                <option value="memory">Vector memory</option>
                <option value="mcp">MCP investigator</option>
              </select>
              <select
                value={incidentId}
                onChange={(e) => setIncidentId(e.target.value)}
                className="ops-input max-w-[200px] py-1.5 text-xs"
                aria-label="Link incident"
              >
                <option value="">Link incident (optional)</option>
                {incidents.filter((i) => i.status !== 'RESOLVED').map((i) => (
                  <option key={i.id} value={i.id}>{i.id}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-ops-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveChat}
                  onChange={(e) => setSaveChat(e.target.checked)}
                  disabled={agentMode === 'mcp'}
                  className="h-3.5 w-3.5 rounded border-ops-border text-brand"
                />
                <Database size={14} weight="regular" aria-hidden /> Save
              </label>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                <div className="rounded-2xl bg-slate-100 p-4 text-ops-subtext mb-4">
                  <Robot size={32} weight="regular" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-ops-text">How can I help with incidents?</h3>
                <p className="mt-1 max-w-md text-sm text-ops-subtext">
                  Ask about past incidents, fixes, or recommended next steps. Saved chats appear in the sidebar.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => run(p)}
                      className="rounded-full border border-ops-border bg-white px-4 py-2 text-xs text-ops-subtext hover:border-brand/30 hover:text-ops-text"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand mt-0.5">
                      <Robot size={16} weight="regular" aria-hidden />
                    </div>
                  )}
                  <div className={`min-w-0 ${msg.role === 'user' ? 'max-w-[85%]' : 'flex-1'}`}>
                    {msg.role === 'user' ? (
                      <div className="rounded-2xl bg-slate-100 px-4 py-3">
                        <p className="text-[15px] leading-relaxed text-ops-text whitespace-pre-wrap">{msg.content}</p>
                        {msg.linkedIncidentId && (
                          <p className="mt-1 font-mono text-xs text-brand">{msg.linkedIncidentId}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {msg.mode && (
                          <p className="text-[11px] font-medium text-ops-muted uppercase tracking-wide">
                            OpsRelay AI
                          </p>
                        )}
                        <ChatMarkdown content={msg.content} />
                        {msg.mcpCitations && msg.mcpCitations.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-2 pt-2">
                            {msg.mcpCitations.map((c) => (
                              <McpCitationCard key={c.citationId} citation={c} onInspectIncident={onInspectIncident} />
                            ))}
                          </div>
                        )}
                        {msg.similarIncidents && msg.similarIncidents.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-2 pt-2">
                            {msg.similarIncidents.slice(0, 4).map((m) => (
                              <MemorySourceCard
                                key={m.id}
                                incident={{
                                  id: m.id,
                                  title: m.title,
                                  similarityScore: m.similarityScore,
                                  service: m.service,
                                  resolvedDuration: '—',
                                  keyTakeaway: m.keyTakeaway,
                                  citations: [],
                                  severity: (m.severity as RelatedIncident['severity']) ?? 'SEV-2',
                                  resolvedDate: new Date().toISOString().split('T')[0],
                                }}
                                onInspect={onInspectIncident}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-ops-subtext mt-0.5">
                      <User size={16} weight="regular" aria-hidden />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
                    <CircleNotch size={16} weight="regular" className="animate-spin" aria-hidden />
                  </div>
                  <p className="text-sm text-ops-muted pt-1">Searching incident memory…</p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-ops-border bg-white px-4 py-4">
            <form
              onSubmit={(e) => { e.preventDefault(); run(); }}
              className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-ops-border bg-slate-50 px-3 py-2 shadow-sm focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand-muted"
            >
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    run();
                  }
                }}
                rows={1}
                placeholder="Message OpsRelay AI…"
                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2.5 text-sm text-ops-text placeholder:text-ops-muted focus:outline-none"
                aria-label="Ask AI"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white disabled:opacity-40 hover:bg-brand/90"
                aria-label="Send"
              >
                {loading ? <CircleNotch size={16} weight="regular" className="animate-spin" aria-hidden /> : <PaperPlaneTilt size={16} weight="regular" aria-hidden />}
              </button>
            </form>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-ops-muted">
              Shift+Enter for new line · {agentMode === 'mcp' ? 'MCP mode returns read-only evidence citations' : 'Answers use your incident database and vector memory'}
            </p>
          </div>
        </div>
      </div>

      {loadingHistory && (
        <p className="mt-2 text-center text-xs text-ops-muted">Loading saved chats…</p>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear all saved chats?"
        message="This permanently deletes all Ask AI conversation history from CockroachDB."
        confirmLabel="Clear history"
        destructive
        onConfirm={() => { setConfirmClear(false); handleClearHistory(); }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
};

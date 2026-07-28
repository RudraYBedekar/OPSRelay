import React, { useState, useEffect } from 'react';
import { Loader2, Send, Sparkles, ListChecks, Database } from 'lucide-react';
import { AgentRecommendation } from './AgentRecommendation';
import { MemorySourceCard } from './MemorySourceCard';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { useToast } from '../common/Toast';
import { apiService } from '../../services/apiService';
import type { Incident, MemoryChatMessage, RelatedIncident } from '../../types/incident';

interface AgentRunResult {
  answer: string;
  similarIncidents: Array<{ id: string; title: string; service: string; similarityScore: number; keyTakeaway: string; severity?: string }>;
  mode: string;
}

const PROMPTS = [
  'What fixed similar DB connection pool errors?',
  'Recommended steps for a SEV-1 API outage',
  'Have we seen auth-service OOM before?',
];

interface AgentConsoleProps {
  incidents: Incident[];
  onInspectIncident: (id: string) => void;
  onGoToTasks?: () => void;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({ incidents, onInspectIncident, onGoToTasks }) => {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const [saveChat, setSaveChat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [chatHistory, setChatHistory] = useState<MemoryChatMessage[]>([]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    apiService.getAgentStatus().then((s) => setAiOn(s.bedrockEnabled)).catch(() => setAiOn(false));
    loadHistory();
  }, []);

  const run = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const agentResult = await apiService.runAgent(q, incidentId || undefined, saveChat) as AgentRunResult;
      setResult(agentResult);
      setQuery('');
      if (saveChat) {
        await loadHistory();
        toast('Conversation saved to database', 'success');
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
      toast('Chat history cleared', 'success');
    } catch {
      toast('Failed to clear history', 'error');
    }
  };

  const nextActions = result
    ? (() => {
        const actionsSection = result.answer.split(/##\s+Recommended Actions/i)[1]?.split(/##\s+/)[0] ?? result.answer;
        return actionsSection
          .split('\n')
          .filter((line) => /^[\d\-•*]\s/.test(line.trim()))
          .slice(0, 6);
      })()
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {!loadingHistory && chatHistory.length > 0 && (
        <ChatHistoryPanel
          chats={chatHistory}
          onClear={handleClearHistory}
          onInspectIncident={onInspectIncident}
          usingCrdb={apiService.isUsingCrdb()}
        />
      )}

      <div className="ops-card p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ops-text">Operational assistant</h2>
            <p className="mt-0.5 text-sm text-ops-subtext">
              Search incident memory and get recommended next steps. Conversations can be saved to CockroachDB.
            </p>
          </div>
          {aiOn === true && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <Sparkles className="h-3 w-3" aria-hidden /> Bedrock live
            </span>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ops-subtext min-h-[44px]">
          <input
            type="checkbox"
            checked={saveChat}
            onChange={(e) => setSaveChat(e.target.checked)}
            className="h-4 w-4 rounded border-ops-border text-brand focus:ring-red-200"
          />
          <Database className="h-4 w-4 shrink-0" aria-hidden />
          Save this conversation to chat history (CockroachDB)
        </label>

        <div>
          <label className="ops-label" htmlFor="agent-incident">Link open incident (optional)</label>
          <select id="agent-incident" value={incidentId} onChange={(e) => setIncidentId(e.target.value)} className="ops-input max-w-md">
            <option value="">None — general query</option>
            {incidents.filter((i) => i.status !== 'RESOLVED').map((i) => (
              <option key={i.id} value={i.id}>{i.id} — {i.title.slice(0, 60)}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="ops-label">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => run(p)}
                disabled={loading}
                className="rounded-full border border-ops-border px-3 py-1.5 text-xs text-ops-subtext hover:bg-slate-50 hover:text-ops-text min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about past incidents, fixes, or recommended next steps…"
            className="ops-input flex-1 min-h-[44px] text-sm"
            aria-label="Ask AI prompt"
          />
          <button type="submit" disabled={loading || !query.trim()} className="ops-btn-primary h-11 w-11 shrink-0 p-0 min-h-[44px]" aria-label="Send">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>
      )}

      {loading && (
        <div className="ops-card flex flex-col items-center gap-3 p-10 text-ops-subtext">
          <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
          <p className="text-sm">Searching vector memory and generating response…</p>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {saveChat && (
            <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" aria-hidden /> Saved to chat history
            </p>
          )}
          <AgentRecommendation answer={result.answer} mode={result.mode} />

          {nextActions.length > 0 && (
            <div className="ops-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ops-text">
                <ListChecks className="h-4 w-4 text-ops-subtext" aria-hidden /> Recommended actions
              </h3>
              <ul className="space-y-2">
                {nextActions.map((line, i) => (
                  <li key={i} className="text-sm text-ops-subtext leading-relaxed">{line.trim()}</li>
                ))}
              </ul>
              {onGoToTasks && (
                <button type="button" onClick={onGoToTasks} className="ops-btn-secondary mt-4 min-h-[44px] text-sm">
                  Open task board
                </button>
              )}
            </div>
          )}

          {result.similarIncidents.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ops-text">Similar incidents (vector memory)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.similarIncidents.map((m) => (
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
                      resolvedDate: '2026-07-26',
                    }}
                    onInspect={onInspectIncident}
                    onCreateTask={onGoToTasks ? () => onGoToTasks() : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

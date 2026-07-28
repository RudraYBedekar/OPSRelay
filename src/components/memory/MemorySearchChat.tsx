import React, { useState, useRef, useEffect } from 'react';
import type { MemoryChatMessage } from '../../types/incident';
import { RelatedIncidentCard } from './RelatedIncidentCard';
import {
  BrainCircuit,
  Send,
  Sparkles,
  Bot,
  User,
  Trash2,
  BookOpen,
  Loader2,
  Terminal
} from 'lucide-react';

interface MemorySearchChatProps {
  chats: MemoryChatMessage[];
  onSendMessage: (queryText: string) => void;
  isQuerying: boolean;
  onClearChats: () => void;
  onInspectIncident: (id: string) => void;
}

export const MemorySearchChat: React.FC<MemorySearchChatProps> = ({
  chats,
  onSendMessage,
  isQuerying,
  onClearChats,
  onInspectIncident
}) => {
  const [inputText, setInputText] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const samplePrompts = [
    'Have we seen this PgBouncer connection pool leak before in billing?',
    'What was the resolution for Kubernetes Auth-Service OOMKilled crash?',
    'Show all SEV-1 incidents related to Redis cluster cache split-brain.',
    'What runbooks exist for CockroachDB range partition lease starvation?'
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, isQuerying]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isQuerying) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handlePromptClick = (promptText: string) => {
    if (isQuerying) return;
    onSendMessage(promptText);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] rounded-xl border border-ops-border bg-ops-card overflow-hidden shadow-card-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ops-border bg-ops-sidebar">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-cockroach-red/15 p-2 text-cockroach-red border border-cockroach-red/30">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-base font-bold text-white tracking-wide">
                OpsRelay Vector Memory & RAG Assistant
              </h2>
              <span className="rounded bg-cockroach-red/20 px-2 py-0.5 text-[10px] font-mono font-bold text-cockroach-red border border-cockroach-red/40">
                1,480 Incidents Indexed
              </span>
            </div>
            <p className="text-xs text-ops-subtext">
              Query vector embeddings for historical root causes, similarity matches, and verified runbooks.
            </p>
          </div>
        </div>

        <button
          onClick={onClearChats}
          className="flex items-center gap-1.5 rounded bg-ops-card hover:bg-ops-cardHover border border-ops-border px-3 py-1.5 text-xs font-mono text-ops-subtext hover:text-white transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear Stream
        </button>
      </div>

      {/* Prompt Suggestion Chips */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-ops-border bg-ops-bg/50">
        <span className="text-xs font-mono text-ops-muted flex items-center gap-1">
          <Terminal className="h-3.5 w-3.5 text-cockroach-red" /> Suggested Queries:
        </span>
        {samplePrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handlePromptClick(prompt)}
            disabled={isQuerying}
            className="rounded-full bg-ops-sidebar hover:bg-cockroach-red/20 hover:text-cockroach-red border border-ops-border px-3 py-1 text-xs font-mono text-ops-subtext transition-colors text-left truncate max-w-xs"
          >
            "{prompt}"
          </button>
        ))}
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {chats.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="h-8 w-8 rounded-lg bg-cockroach-red text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-glow-red-sm">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-3xl space-y-4 rounded-xl p-4 font-mono text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-cockroach-red/15 border border-cockroach-red/40 text-white'
                  : 'bg-ops-sidebar border border-ops-border text-ops-text'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-ops-muted border-b border-ops-border/60 pb-1.5 mb-2">
                <span className="font-bold uppercase tracking-wider text-white">
                  {msg.sender === 'user' ? 'SRE Engineer Query' : 'OpsRelay RAG Agent Response'}
                </span>
                <span>{msg.timestamp}</span>
              </div>

              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Matched Incident Cards */}
              {msg.matchedIncidents && msg.matchedIncidents.length > 0 && (
                <div className="mt-4 pt-3 border-t border-ops-border space-y-3">
                  <div className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-cockroach-red" />
                    Top Vector Similarity Matches ({msg.matchedIncidents.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {msg.matchedIncidents.map(inc => (
                      <RelatedIncidentCard
                        key={inc.id}
                        incident={inc}
                        onInspect={onInspectIncident}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Runbooks */}
              {msg.suggestedRunbooks && msg.suggestedRunbooks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ops-border space-y-2">
                  <div className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                    Recommended Operations Runbook
                  </div>
                  {msg.suggestedRunbooks.map((rb, idx) => (
                    <div key={idx} className="rounded bg-ops-card p-3 border border-ops-border space-y-1.5">
                      <div className="font-bold text-white flex items-center justify-between">
                        <span>{rb.title}</span>
                        <a
                          href={rb.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-cockroach-red hover:underline"
                        >
                          View Wiki
                        </a>
                      </div>
                      {rb.codeSnippet && (
                        <pre className="bg-ops-bg p-2 rounded text-[11px] text-emerald-400 overflow-x-auto border border-ops-border">
                          {rb.codeSnippet}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="h-8 w-8 rounded-lg bg-ops-sidebar border border-ops-border text-ops-subtext flex items-center justify-center font-bold text-xs shrink-0">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isQuerying && (
          <div className="flex items-center gap-3 text-xs font-mono text-cockroach-red">
            <div className="h-8 w-8 rounded-lg bg-cockroach-red/20 text-cockroach-red flex items-center justify-center border border-cockroach-red/40 animate-pulse">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>OpsRelay scanning vector memory embeddings & incident logs...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Field Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-ops-border bg-ops-sidebar">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask a question... (e.g. 'Have we seen this PostgreSQL connection leak before?')"
            className="w-full rounded-lg bg-ops-bg border border-ops-border pl-4 pr-12 py-3 text-xs font-mono text-white placeholder-ops-muted focus:border-cockroach-red focus:outline-none focus:ring-1 focus:ring-cockroach-red"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isQuerying}
            className="absolute right-2 p-2 rounded-md bg-cockroach-red hover:bg-cockroach-redHover text-white disabled:opacity-40 transition-all shadow-glow-red-sm"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

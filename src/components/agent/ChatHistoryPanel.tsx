import React, { useState } from 'react';
import type { MemoryChatMessage } from '../../types/incident';
import { MemorySourceCard } from '../agent/MemorySourceCard';
import { ClockCounterClockwise, CaretDown, CaretUp, User, Robot, Trash } from '@phosphor-icons/react';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ChatHistoryPanelProps {
  chats: MemoryChatMessage[];
  onClear: () => void;
  onInspectIncident: (id: string) => void;
  usingCrdb: boolean;
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  chats,
  onClear,
  onInspectIncident,
  usingCrdb,
}) => {
  const [open, setOpen] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  if (chats.length === 0) return null;

  const pairs: { user?: MemoryChatMessage; assistant?: MemoryChatMessage }[] = [];
  for (let i = 0; i < chats.length; i++) {
    const msg = chats[i];
    if (msg.sender === 'user') {
      pairs.push({ user: msg, assistant: chats[i + 1]?.sender === 'assistant' ? chats[i + 1] : undefined });
      if (chats[i + 1]?.sender === 'assistant') i++;
    } else if (msg.sender === 'assistant' && (i === 0 || chats[i - 1]?.sender !== 'user')) {
      pairs.push({ assistant: msg });
    }
  }

  return (
    <>
      <div className="ops-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-ops-border bg-slate-50/50">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex flex-1 items-center gap-2 text-left min-h-[44px]"
          >
            <ClockCounterClockwise size={16} weight="regular" className="text-ops-subtext" aria-hidden />
            <span className="text-sm font-semibold text-ops-text">
              Saved chat history ({pairs.length})
            </span>
            {usingCrdb && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                CockroachDB
              </span>
            )}
            {open ? <CaretUp size={16} weight="regular" className="text-ops-muted ml-auto" aria-hidden /> : <CaretDown size={16} weight="regular" className="text-ops-muted ml-auto" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="ops-btn-secondary text-xs py-1 px-2 min-h-[36px] shrink-0"
            title="Clear all saved chats"
          >
            <Trash size={14} weight="regular" aria-hidden /> Clear
          </button>
        </div>

        {open && (
          <div className="max-h-[28rem] overflow-y-auto border-t border-ops-border divide-y divide-ops-border">
            {[...pairs].reverse().map((pair, idx) => (
              <div key={pair.user?.id ?? pair.assistant?.id ?? idx} className="space-y-3 p-4 md:p-5">
                {pair.user && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ops-subtext">
                      <User size={16} weight="regular" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-ops-muted">{pair.user.timestamp} · You</p>
                      <p className="mt-0.5 text-sm text-ops-text">{pair.user.text}</p>
                      {pair.user.linkedIncidentId && (
                        <p className="mt-1 text-xs text-brand font-mono">{pair.user.linkedIncidentId}</p>
                      )}
                    </div>
                  </div>
                )}
                {pair.assistant && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
                      <Robot size={16} weight="regular" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className="text-[11px] font-medium text-ops-muted">
                        {pair.assistant.timestamp} · AI
                        {pair.assistant.agentMode && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">{pair.assistant.agentMode}</span>
                        )}
                      </p>
                      <p className="text-sm leading-relaxed text-ops-subtext whitespace-pre-wrap line-clamp-8">
                        {pair.assistant.text}
                      </p>
                      {pair.assistant.matchedIncidents && pair.assistant.matchedIncidents.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {pair.assistant.matchedIncidents.slice(0, 2).map((m) => (
                            <MemorySourceCard key={m.id} incident={m} onInspect={onInspectIncident} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all saved chats?"
        message="This permanently deletes all Ask AI conversation history from CockroachDB. This cannot be undone."
        confirmLabel="Clear history"
        destructive
        onConfirm={() => { setConfirmClear(false); onClear(); }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
};

import React from 'react';
import { ChatCircleDots, Trash, SidebarSimple } from '@phosphor-icons/react';
import { buildChatThreads, type ChatThread } from '../../utils/chatThreads';

export type { ChatThread };
export { buildChatThreads };

interface ChatSidebarProps {
  threads: ChatThread[];
  activeThreadId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  onSelectThread: (thread: ChatThread) => void;
  onClearHistory: () => void;
  usingCrdb: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  threads,
  activeThreadId,
  collapsed,
  onToggleCollapse,
  onNewChat,
  onSelectThread,
  onClearHistory,
  usingCrdb,
}) => {
  if (collapsed) {
    return (
      <div className="flex w-12 shrink-0 flex-col items-center border-r border-ops-border bg-slate-50 py-3 gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded-lg p-2 text-ops-muted hover:bg-white hover:text-ops-text"
          title="Show chat history"
        >
          <SidebarSimple size={20} weight="regular" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="rounded-lg p-2 text-ops-muted hover:bg-white hover:text-brand"
          title="New chat"
        >
          <ChatCircleDots size={20} weight="regular" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-ops-border bg-slate-50 md:w-72">
      <div className="flex items-center gap-2 border-b border-ops-border p-3">
        <button type="button" onClick={onNewChat} className="ops-btn-primary flex-1 min-h-[40px] text-xs gap-1.5">
          <ChatCircleDots size={16} weight="regular" aria-hidden /> New chat
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded-lg border border-ops-border bg-white p-2 text-ops-muted hover:text-ops-text min-h-[40px] min-w-[40px]"
          title="Hide sidebar"
        >
          <SidebarSimple size={16} weight="regular" aria-hidden />
        </button>
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ops-muted">
          Saved chats {usingCrdb ? '· DB' : ''}
        </p>
        {threads.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="rounded p-1 text-ops-muted hover:bg-red-50 hover:text-red-600"
            title="Clear all chats"
          >
            <Trash size={14} weight="regular" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {threads.length === 0 ? (
          <p className="px-2 py-4 text-xs text-ops-muted leading-relaxed">
            No saved conversations yet. Ask a question and enable save to build history here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => onSelectThread(thread)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors min-h-[44px] ${
                    activeThreadId === thread.id
                      ? 'bg-white shadow-sm ring-1 ring-ops-border'
                      : 'hover:bg-white/80'
                  }`}
                >
                  <p className="truncate text-sm font-medium text-ops-text">{thread.title}</p>
                  <p className="mt-0.5 text-[10px] text-ops-muted">{thread.timestamp}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};

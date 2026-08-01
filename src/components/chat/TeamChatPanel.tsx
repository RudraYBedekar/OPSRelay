import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clock,
  Loader2,
  MessageCircle,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import type {
  GuestDuration,
  TeamChatDetail,
  TeamChatMember,
  TeamChatSummary,
} from '../../types/teamChat';
import { formatDate } from '../../utils/formatters';

function formatGuestCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

interface TeamChatPanelProps {
  memberId?: string;
  userName?: string;
}

export const TeamChatPanel: React.FC<TeamChatPanelProps> = ({ memberId, userName }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<TeamChatSummary[]>([]);
  const [members, setMembers] = useState<TeamChatMember[]>([]);
  const [activeChat, setActiveChat] = useState<TeamChatDetail | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [newChatMemberId, setNewChatMemberId] = useState('');
  const [guestMemberId, setGuestMemberId] = useState('');
  const [guestDuration, setGuestDuration] = useState<GuestDuration>(15);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [guestRemainingMs, setGuestRemainingMs] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    if (!apiService.isUsingCrdb()) return;
    try {
      const [chatList, memberList] = await Promise.all([
        apiService.listTeamChats(),
        apiService.listTeamChatMembers(),
      ]);
      setChats(chatList);
      setMembers(memberList);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load chats', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadChatDetail = useCallback(async (chatId: string) => {
    try {
      const detail = await apiService.getTeamChat(chatId);
      setActiveChat(detail);
      setGuestRemainingMs(detail.activeGuest?.remainingMs ?? 0);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load chat', 'error');
    }
  }, [toast]);

  useEffect(() => { void loadChats(); }, [loadChats]);

  useEffect(() => {
    if (!selectedChatId) return;
    void loadChatDetail(selectedChatId);
    const id = window.setInterval(() => { void loadChatDetail(selectedChatId); }, 5000);
    return () => window.clearInterval(id);
  }, [selectedChatId, loadChatDetail]);

  useEffect(() => {
    if (!activeChat?.activeGuest) return;
    const id = window.setInterval(() => {
      setGuestRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeChat?.activeGuest?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length]);

  const startChat = async (targetMemberId: string) => {
    setSending(true);
    try {
      const detail = await apiService.createTeamChat(targetMemberId);
      setActiveChat(detail);
      setSelectedChatId(detail.id);
      setNewChatMemberId('');
      await loadChats();
      toast('Chat started', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start chat', 'error');
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedChatId || !messageText.trim()) return;
    setSending(true);
    try {
      await apiService.sendTeamChatMessage(selectedChatId, messageText.trim());
      setMessageText('');
      await loadChatDetail(selectedChatId);
      await loadChats();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Send failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const inviteGuest = async () => {
    if (!selectedChatId || !guestMemberId.trim()) return;
    setSending(true);
    try {
      const detail = await apiService.inviteTeamChatGuest(
        selectedChatId,
        guestMemberId.trim(),
        guestDuration,
      );
      setActiveChat(detail);
      setGuestRemainingMs(detail.activeGuest?.remainingMs ?? 0);
      setGuestMemberId('');
      setShowGuestForm(false);
      toast(`Guest added for ${guestDuration} minutes`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Invite failed', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!apiService.isUsingCrdb()) {
    return (
      <div className="ops-card p-6 text-center text-sm text-ops-subtext">
        Team chat requires login and CockroachDB mode.
      </div>
    );
  }

  if (!memberId) {
    return (
      <div className="ops-card p-6 text-center text-sm text-ops-subtext">
        Sign in to use team chat between members.
      </div>
    );
  }

  const otherParticipant = activeChat?.participants.find((p) => p.memberId !== memberId);
  const isGuestViewer = activeChat?.activeGuest?.guestMemberId === memberId;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
          <MessageCircle className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-bold text-ops-text">Team chat</h2>
          <p className="text-xs text-ops-muted">
            Message a teammate — invite a third member for 15 or 30 minutes
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] min-h-[520px]">
        {/* Chat list */}
        <div className="ops-card flex flex-col overflow-hidden">
          <div className="border-b border-ops-border p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ops-muted">New chat</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newChatMemberId}
                onChange={(e) => setNewChatMemberId(e.target.value.toUpperCase())}
                placeholder="MEM-XXXXXXXX"
                className="ops-input flex-1 text-xs font-mono"
              />
              <button
                type="button"
                disabled={sending || !newChatMemberId.trim()}
                onClick={() => void startChat(newChatMemberId.trim())}
                className="ops-btn-primary text-xs px-2 min-h-[36px]"
              >
                Go
              </button>
            </div>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {members.slice(0, 4).map((m) => (
                  <button
                    key={m.memberId}
                    type="button"
                    onClick={() => void startChat(m.memberId)}
                    className="rounded-full border border-ops-border bg-white px-2 py-0.5 text-[11px] text-ops-subtext hover:border-brand hover:text-brand"
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
              </div>
            ) : chats.length === 0 ? (
              <p className="p-3 text-sm text-ops-muted">No conversations yet.</p>
            ) : (
              <ul className="space-y-1">
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatId(chat.id);
                        setShowGuestForm(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                        selectedChatId === chat.id ? 'bg-red-50 border border-red-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-ops-text truncate">
                        {chat.otherMember.name}
                      </p>
                      <p className="text-[10px] font-mono text-ops-muted">{chat.otherMember.memberId}</p>
                      {chat.lastMessage && (
                        <p className="mt-1 text-xs text-ops-subtext truncate">{chat.lastMessage}</p>
                      )}
                      {chat.activeGuest && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                          <Users className="h-3 w-3" aria-hidden />
                          Guest active
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Message area */}
        <div className="ops-card flex flex-col overflow-hidden">
          {!activeChat ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-ops-muted">
              <MessageCircle className="h-10 w-10 mb-3 opacity-40" aria-hidden />
              <p className="text-sm">Select a chat or start one with a member ID</p>
              {userName && (
                <p className="mt-2 text-xs">Signed in as {userName} ({memberId})</p>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-ops-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ops-text">
                      {isGuestViewer ? 'Guest session' : otherParticipant?.name ?? 'Chat'}
                    </p>
                    <p className="text-xs text-ops-muted font-mono">
                      {isGuestViewer
                        ? `Temporary access · ${memberId}`
                        : otherParticipant?.memberId}
                    </p>
                  </div>
                  {!isGuestViewer && (
                    <button
                      type="button"
                      onClick={() => setShowGuestForm((v) => !v)}
                      className="ops-btn-secondary text-xs min-h-[32px]"
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden />
                      Add guest
                    </button>
                  )}
                </div>

                {activeChat.activeGuest && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                    <Users className="h-4 w-4 text-violet-600 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-violet-900">
                        Guest: {activeChat.activeGuest.guestName} ({activeChat.activeGuest.guestMemberId})
                      </p>
                      <p className="text-[11px] text-violet-700">
                        {activeChat.activeGuest.durationMinutes}-minute access
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono font-semibold text-violet-800">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {formatGuestCountdown(guestRemainingMs)}
                    </div>
                  </div>
                )}

                {showGuestForm && !isGuestViewer && (
                  <div className="mt-3 rounded-lg border border-ops-border bg-slate-50 p-3 space-y-2">
                    <p className="text-xs font-medium text-ops-text">Invite third member (timed)</p>
                    <input
                      type="text"
                      value={guestMemberId}
                      onChange={(e) => setGuestMemberId(e.target.value.toUpperCase())}
                      placeholder="Guest MEM-ID"
                      className="ops-input text-xs font-mono"
                    />
                    <div className="flex gap-2">
                      {([15, 30] as GuestDuration[]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setGuestDuration(d)}
                          className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${
                            guestDuration === d
                              ? 'border-brand bg-red-50 text-brand'
                              : 'border-ops-border bg-white text-ops-subtext'
                          }`}
                        >
                          {d} min
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={sending || !guestMemberId.trim()}
                      onClick={() => void inviteGuest()}
                      className="ops-btn-primary w-full text-sm min-h-[36px]"
                    >
                      Invite guest
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[420px]">
                {activeChat.messages.map((msg) => {
                  const isMine = msg.senderMemberId === memberId;
                  const isSystem = msg.messageType === 'system';
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="text-center">
                        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] text-ops-muted">
                          {msg.text}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                          isMine
                            ? 'bg-brand text-white rounded-br-md'
                            : 'bg-slate-100 text-ops-text rounded-bl-md'
                        }`}
                      >
                        {!isMine && (
                          <p className="text-[10px] font-medium opacity-70 mb-0.5">{msg.senderName}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className={`mt-1 text-[10px] ${isMine ? 'text-red-100' : 'text-ops-muted'}`}>
                          {formatDate(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-ops-border p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Type a message…"
                    className="ops-input flex-1"
                    disabled={sending}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={sending || !messageText.trim()}
                    className="ops-btn-primary min-h-[44px] px-4"
                    aria-label="Send message"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
                {user?.memberId === activeChat.activeGuest?.guestMemberId && guestRemainingMs <= 0 && (
                  <p className="mt-2 text-xs text-red-600">Your guest access has expired.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

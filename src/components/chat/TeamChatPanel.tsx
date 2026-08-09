import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Clock,
  Image,
  CircleNotch,
  ChatsCircle,
  PaperPlaneTilt,
  Trash,
  UserMinus,
  UserPlus,
  Users,
} from '@phosphor-icons/react';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { ChatCameraModal } from './ChatCameraModal';
import type {
  GuestDuration,
  TeamChatDetail,
  TeamChatSummary,
} from '../../types/teamChat';
import { GUEST_DURATION_OPTIONS } from '../../types/teamChat';
import { formatDate } from '../../utils/formatters';
import { compressImageForChat } from '../../utils/chatImage';

function formatGuestCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin >= 60) {
    const hours = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return `${hours}h ${min.toString().padStart(2, '0')}m`;
  }
  const sec = Math.floor((ms % 60000) / 1000);
  return `${totalMin}:${sec.toString().padStart(2, '0')}`;
}

function formatDurationLabel(minutes: number): string {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${minutes}m`;
  }
  return `${minutes}m`;
}

interface TeamChatPanelProps {
  memberId?: string;
  userName?: string;
  onUnreadChange?: () => void;
}

export const TeamChatPanel: React.FC<TeamChatPanelProps> = ({ memberId, userName, onUnreadChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<TeamChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<TeamChatDetail | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [newChatMemberId, setNewChatMemberId] = useState('');
  const [guestMemberId, setGuestMemberId] = useState('');
  const [guestDuration, setGuestDuration] = useState<GuestDuration>(15);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [guestRemainingMs, setGuestRemainingMs] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadChats = useCallback(async () => {
    if (!apiService.isUsingCrdb()) return;
    try {
      const chatList = await apiService.listTeamChats();
      setChats(chatList);
      onUnreadChange?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load chats', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, onUnreadChange]);

  const loadChatDetail = useCallback(async (chatId: string) => {
    try {
      const detail = await apiService.getTeamChat(chatId);
      setActiveChat(detail);
      setGuestRemainingMs(detail.activeGuest?.remainingMs ?? 0);
      onUnreadChange?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load chat', 'error');
    }
  }, [toast, onUnreadChange]);

  useEffect(() => { void loadChats(); }, [loadChats]);

  useEffect(() => {
    if (!memberId) return;
    const id = window.setInterval(() => { void loadChats(); }, 8000);
    return () => window.clearInterval(id);
  }, [memberId, loadChats]);

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

  const sendPayload = async (payload: { text?: string; imageData?: string }) => {
    if (!selectedChatId) return;
    if (!payload.text?.trim() && !payload.imageData) return;

    setSending(true);
    try {
      await apiService.sendTeamChatMessage(selectedChatId, payload);
      setMessageText('');
      await loadChatDetail(selectedChatId);
      await loadChats();
      toast('Message sent', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Send failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    await sendPayload({ text: messageText.trim() });
  };

  const sendImage = async (imageData: string, caption?: string) => {
    await sendPayload({ text: caption, imageData });
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error');
      return;
    }
    setSending(true);
    try {
      const imageData = await compressImageForChat(file);
      await sendImage(imageData, messageText.trim() || undefined);
      setMessageText('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Image upload failed', 'error');
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
      toast(`Guest added for ${GUEST_DURATION_OPTIONS.find((o) => o.value === guestDuration)?.label ?? `${guestDuration}m`}`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Invite failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const removeGuest = async () => {
    if (!selectedChatId || !activeChat?.activeGuest) return;
    setSending(true);
    try {
      const detail = await apiService.removeTeamChatGuest(
        selectedChatId,
        activeChat.activeGuest.id,
      );
      setActiveChat(detail);
      setGuestRemainingMs(0);
      toast('Guest removed from chat', 'success');
      await loadChats();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Remove failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!selectedChatId) return;
    setSending(true);
    try {
      await apiService.deleteTeamChatMessage(selectedChatId, messageId);
      setActiveChat((prev) =>
        prev
          ? { ...prev, messages: prev.messages.filter((m) => m.id !== messageId) }
          : prev,
      );
      toast('Message deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const deleteChat = async () => {
    if (!selectedChatId || !activeChat) return;
    const other = activeChat.participants.find((p) => p.memberId !== memberId);
    const otherName = other?.name ?? 'this person';
    if (!window.confirm(`Delete the entire chat with ${otherName}? All messages will be permanently removed.`)) {
      return;
    }
    setSending(true);
    try {
      await apiService.deleteTeamChat(selectedChatId);
      setActiveChat(null);
      setSelectedChatId(null);
      setShowGuestForm(false);
      await loadChats();
      toast('Chat deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
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
      <ChatCameraModal
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(imageData) => void sendImage(imageData, messageText.trim() || undefined)}
      />

      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
          <ChatsCircle size={16} weight="regular" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-bold text-ops-text">Team chat</h2>
          <p className="text-xs text-ops-muted">
            Text, images, live camera — timed guests auto-removed or manual kick
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] min-h-[520px]">
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
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <CircleNotch size={24} weight="regular" className="animate-spin text-brand" aria-hidden />
              </div>
            ) : chats.length === 0 ? (
              <p className="p-3 text-sm text-ops-muted">No conversations yet.</p>
            ) : (
              <ul className="space-y-1">
                {chats.map((chat) => {
                  const unread = chat.unreadCount ?? 0;
                  return (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatId(chat.id);
                        setShowGuestForm(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                        selectedChatId === chat.id ? 'bg-brand-light border border-brand-muted' : 'hover:bg-slate-50'
                      } ${unread > 0 ? 'border-l-2 border-l-brand' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-ops-text' : 'font-medium text-ops-text'}`}>
                          {chat.otherMember.name}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-ops-muted">{chat.otherMember.memberId}</p>
                      {chat.lastMessage && (
                        <p className="mt-1 text-xs text-ops-subtext truncate">{chat.lastMessage}</p>
                      )}
                      {chat.activeGuest && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                          <Users size={12} weight="regular" aria-hidden />
                          Guest active
                        </span>
                      )}
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="ops-card flex flex-col overflow-hidden">
          {!activeChat ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-ops-muted">
              <ChatsCircle size={40} weight="regular" className="mb-3 opacity-40" aria-hidden />
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowGuestForm((v) => !v)}
                        className="ops-btn-secondary text-xs min-h-[32px]"
                      >
                        <UserPlus size={14} weight="regular" aria-hidden />
                        Add guest
                      </button>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => void deleteChat()}
                        className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 min-h-[32px]"
                        title="Delete entire chat"
                      >
                        <Trash size={14} weight="regular" aria-hidden />
                        Delete chat
                      </button>
                    </div>
                  )}
                </div>

                {activeChat.activeGuest && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                    <Users size={16} weight="regular" className="text-violet-600 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-violet-900">
                        Guest: {activeChat.activeGuest.guestName} ({activeChat.activeGuest.guestMemberId})
                      </p>
                      <p className="text-[11px] text-violet-700">
                        Auto-removes in {formatDurationLabel(activeChat.activeGuest.durationMinutes)} · expires{' '}
                        {formatDate(activeChat.activeGuest.expiresAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono font-semibold text-violet-800">
                      <Clock size={14} weight="regular" aria-hidden />
                      {formatGuestCountdown(guestRemainingMs)}
                    </div>
                    {!isGuestViewer && (
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => void removeGuest()}
                        className="rounded-lg border border-violet-300 bg-white px-2 py-1 text-[11px] font-medium text-violet-800 hover:bg-violet-100"
                        title="Remove guest now"
                      >
                        <UserMinus size={14} weight="regular" aria-hidden />
                      </button>
                    )}
                  </div>
                )}

                {showGuestForm && !isGuestViewer && (
                  <div className="mt-3 rounded-lg border border-ops-border bg-slate-50 p-3 space-y-2">
                    <p className="text-xs font-medium text-ops-text">Invite third member (auto-removed after)</p>
                    <input
                      type="text"
                      value={guestMemberId}
                      onChange={(e) => setGuestMemberId(e.target.value.toUpperCase())}
                      placeholder="Guest MEM-ID"
                      className="ops-input text-xs font-mono"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {GUEST_DURATION_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setGuestDuration(value)}
                          className={`rounded-lg border py-1.5 text-[11px] font-medium min-h-[36px] ${
                            guestDuration === value
                              ? 'border-brand bg-brand-light text-brand'
                              : 'border-ops-border bg-white text-ops-subtext'
                          }`}
                        >
                          {label}
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
                  const isImage = msg.messageType === 'image' && msg.imageData;

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
                    <div key={msg.id} className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`relative max-w-[80%] rounded-2xl px-3.5 py-2 ${
                          isMine
                            ? 'bg-brand text-white rounded-br-md'
                            : 'bg-slate-100 text-ops-text rounded-bl-md'
                        }`}
                      >
                        {!isMine && (
                          <p className="text-[10px] font-medium opacity-70 mb-0.5">{msg.senderName}</p>
                        )}
                        {isImage && (
                          <a href={msg.imageData} target="_blank" rel="noopener noreferrer">
                            <img
                              src={msg.imageData}
                              alt="Chat attachment"
                              className="max-h-48 rounded-lg mb-1 object-cover"
                            />
                          </a>
                        )}
                        {msg.text && msg.text !== '📷 Photo' && (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                        )}
                        <div className={`mt-1 flex items-center gap-2 ${isMine ? 'justify-between' : 'justify-between'}`}>
                          <p className={`text-[10px] ${isMine ? 'text-white/70' : 'text-ops-muted'}`}>
                            {formatDate(msg.createdAt)}
                          </p>
                          {(isMine || !isGuestViewer) && (
                            <button
                              type="button"
                              onClick={() => void deleteMessage(msg.id)}
                              disabled={sending}
                              className={`rounded p-0.5 opacity-70 hover:opacity-100 ${
                                isMine ? 'text-white/70 hover:bg-brand/80' : 'text-ops-muted hover:bg-slate-200'
                              }`}
                              aria-label="Delete message"
                              title="Delete message"
                            >
                              <Trash size={12} weight="regular" aria-hidden />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-ops-border p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void handleFilePick(e)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="ops-btn-secondary min-h-[44px] px-3"
                    aria-label="Upload image"
                    title="Upload image"
                  >
                    <Image size={16} weight="regular" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    disabled={sending}
                    className="ops-btn-secondary min-h-[44px] px-3"
                    aria-label="Live camera"
                    title="Live camera"
                  >
                    <Camera size={16} weight="regular" aria-hidden />
                  </button>
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
                    placeholder="Type a message or caption…"
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
                      <CircleNotch size={16} weight="regular" className="animate-spin" aria-hidden />
                    ) : (
                      <PaperPlaneTilt size={16} weight="regular" aria-hidden />
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

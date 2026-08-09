import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../services/apiService';
import { useToast } from '../components/common/Toast';

export function useTeamChatUnread(memberId?: string, activeTab?: string) {
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef(0);
  const prevLatestRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const enabled = Boolean(memberId && apiService.isUsingCrdb());

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    try {
      const [chats, countResult] = await Promise.all([
        apiService.listTeamChats(),
        apiService.getTeamChatUnreadCount(),
      ]);
      const total = countResult.totalUnread;
      const latestUnread = chats.find((c) => (c.unreadCount ?? 0) > 0);
      const latestKey = latestUnread
        ? `${latestUnread.id}:${latestUnread.lastMessageAt ?? ''}`
        : null;

      if (
        initializedRef.current &&
        activeTab !== 'chat' &&
        total > prevUnreadRef.current &&
        latestKey &&
        latestKey !== prevLatestRef.current
      ) {
        const from = latestUnread?.otherMember.name ?? 'Teammate';
        const preview = latestUnread?.lastMessage?.slice(0, 60) ?? 'New message';
        toast(`${from}: ${preview}`, 'info');
      }

      initializedRef.current = true;
      prevUnreadRef.current = total;
      prevLatestRef.current = latestKey;
      setUnreadCount(total);
    } catch {
      /* ignore polling errors */
    }
  }, [activeTab, enabled, toast]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, 8000);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return { unreadCount, refreshUnread: refresh };
}

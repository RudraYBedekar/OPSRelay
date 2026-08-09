import type { MemoryChatMessage } from '../types/incident';

export interface ChatThread {
  id: string;
  title: string;
  timestamp: string;
  messages: MemoryChatMessage[];
}

/** Group key for pairing user + assistant rows (supports legacy ids). */
export function chatPairKey(msg: MemoryChatMessage): string {
  if (msg.threadId) return msg.threadId;
  const legacy = msg.id.match(/^(?:user|msg|asst)-(\d+)/);
  if (legacy) return `legacy-${legacy[1]}`;
  return msg.id;
}

function sortMessages(messages: MemoryChatMessage[]): MemoryChatMessage[] {
  return [...messages].sort((a, b) => {
    if (a.sender === b.sender) return a.id.localeCompare(b.id);
    return a.sender === 'user' ? -1 : 1;
  });
}

/** Build sidebar threads from flat memory_chats rows. */
export function buildChatThreads(chats: MemoryChatMessage[]): ChatThread[] {
  const groups = new Map<string, MemoryChatMessage[]>();

  for (const msg of chats) {
    const key = chatPairKey(msg);
    const bucket = groups.get(key) ?? [];
    bucket.push(msg);
    groups.set(key, bucket);
  }

  const userOrder = new Map<string, number>();
  chats.forEach((msg, index) => {
    if (msg.sender === 'user' && !userOrder.has(msg.id)) {
      userOrder.set(msg.id, index);
    }
  });

  const threads: ChatThread[] = [];
  for (const msgs of groups.values()) {
    const sorted = sortMessages(msgs);
    const userMsg = sorted.find((m) => m.sender === 'user');
    if (!userMsg) continue;

    threads.push({
      id: userMsg.id,
      title: userMsg.text.slice(0, 48) + (userMsg.text.length > 48 ? '…' : ''),
      timestamp: userMsg.timestamp,
      messages: sorted,
    });
  }

  threads.sort((a, b) => (userOrder.get(a.id) ?? 0) - (userOrder.get(b.id) ?? 0));
  return threads.reverse();
}

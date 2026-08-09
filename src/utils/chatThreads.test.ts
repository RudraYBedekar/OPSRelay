import { describe, expect, it } from 'vitest';
import { buildChatThreads } from './chatThreads';
import type { MemoryChatMessage } from '../types/incident';

describe('buildChatThreads', () => {
  it('pairs user and assistant when assistant row sorts before user (legacy ids)', () => {
    const ts = '1734567890123';
    const chats: MemoryChatMessage[] = [
      {
        id: `msg-${ts}`,
        sender: 'assistant',
        text: 'Restart the payment-api pods and verify webhook retries.',
        timestamp: '6:10 PM',
      },
      {
        id: `user-${ts}`,
        sender: 'user',
        text: 'Triage payment-api incident',
        timestamp: '6:10 PM',
      },
    ];

    const threads = buildChatThreads(chats);
    expect(threads).toHaveLength(1);
    expect(threads[0].messages).toHaveLength(2);
    expect(threads[0].messages[0].sender).toBe('user');
    expect(threads[0].messages[1].sender).toBe('assistant');
    expect(threads[0].messages[1].text).toContain('Restart the payment-api');
  });

  it('groups by threadId when present', () => {
    const chats: MemoryChatMessage[] = [
      {
        id: 'thread-1-assistant',
        threadId: 'thread-1',
        sender: 'assistant',
        text: 'Answer B',
        timestamp: '6:11 PM',
      },
      {
        id: 'thread-1-user',
        threadId: 'thread-1',
        sender: 'user',
        text: 'Question B',
        timestamp: '6:11 PM',
      },
    ];

    const threads = buildChatThreads(chats);
    expect(threads[0].messages.map((m) => m.sender)).toEqual(['user', 'assistant']);
  });
});

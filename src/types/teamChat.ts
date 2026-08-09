export type GuestDuration = 5 | 15 | 30 | 60 | 120 | 240 | 480 | 1440;

export const GUEST_DURATION_OPTIONS: Array<{ value: GuestDuration; label: string }> = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 1440, label: '24 hours' },
];


export type ChatMessageType = 'user' | 'system' | 'image';

export interface TeamChatMember {
  memberId: string;
  name: string;
}

export interface TeamChatGuest {
  id: string;
  guestMemberId: string;
  guestName: string;
  invitedByMemberId: string;
  durationMinutes: GuestDuration;
  expiresAt: string;
  status: 'active' | 'expired';
  remainingMs: number;
}

export interface TeamChatMessage {
  id: string;
  chatId: string;
  senderMemberId: string;
  senderName: string;
  text: string;
  messageType: ChatMessageType;
  imageData?: string;
  createdAt: string;
}

export interface TeamChatSummary {
  id: string;
  otherMember: TeamChatMember;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  unreadHint?: boolean;
  activeGuest?: TeamChatGuest;
  updatedAt: string;
}

export interface TeamChatDetail {
  id: string;
  participants: TeamChatMember[];
  messages: TeamChatMessage[];
  activeGuest?: TeamChatGuest;
  createdAt: string;
  updatedAt: string;
}

export interface SendTeamChatMessageInput {
  text?: string;
  imageData?: string;
}

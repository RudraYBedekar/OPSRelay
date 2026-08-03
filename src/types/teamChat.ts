export type GuestDuration = 5 | 15 | 30 | 60;

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

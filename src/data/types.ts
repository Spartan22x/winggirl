export type UserProfile = {
  id: string;
  firstName: string;
  age: number;
  distance: string;
  interests: string[];
  available: boolean;
  bio: string;
  connections: number;
  avatarColor: string;
  activity: string;
  friends: number;
  friendsOfFriends: boolean;
};

export type ConnectionProfile = {
  id: string;
  firstName: string;
  age: number | null;
  bio: string;
  avatarColor: string;
};

export type ConnectionRelationshipStatus =
  | 'none'
  | 'outgoing_pending'
  | 'incoming_pending'
  | 'accepted'
  | 'declined';

export type ConnectionRequestResult =
  | 'requested'
  | 'outgoing_pending'
  | 'incoming_pending'
  | 'connected';

export type IncomingConnectionRequest = {
  requesterId: string;
  createdAt: string;
  profile: ConnectionProfile | null;
};

export type AcceptedConnection = {
  profileId: string;
  connectedAt: string;
  profile: ConnectionProfile | null;
};

export type PlanStatus = 'upcoming' | 'invited' | 'past' | 'joined' | 'cancelled';
export type PlanVisibility = 'invite_only' | 'open';
export type PlanMemberStatus = 'invited' | 'joined' | 'declined';

export type PlanParticipant = {
  profileId: string;
  firstName: string;
  age: number | null;
  avatarColor: string;
  status: PlanMemberStatus;
};

export type PlanOverlapCandidate = {
  id: string;
  activity: string;
  startsAt: string;
  isHost: boolean;
  currentUserStatus: PlanMemberStatus | null;
};

export type PlanItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  startsAt: string;
  activity: string;
  secondaryActivity?: string | null;
  status: PlanStatus;
  visibility: PlanVisibility;
  isOpenPlan: boolean;
  hostId: string;
  isHost: boolean;
  currentUserStatus: PlanMemberStatus | null;
  participants: PlanParticipant[];
  attendees: string[];
  location: string;
  host: string;
  note: string;
};

export type PlanDetails = PlanItem & {
  hostProfile: {
    id: string;
    firstName: string;
    age: number | null;
    bio: string;
    avatarColor: string;
  } | null;
};

export type Message = {
  id: string;
  conversationId: ConversationId;
  senderId: string;
  sender: string;
  text: string;
  createdAt: string;
  time: string;
  me?: boolean;
};

export type ConversationId = string;
export type ConversationType = 'direct' | 'group';

export type ConversationParticipant = {
  profileId: string;
  firstName: string | null;
  profileImageUrl: string | null;
  avatarColor: string | null;
};

export type Conversation = {
  id: ConversationId;
  createdBy: string;
  planId: string | null;
  conversationType: ConversationType;
  directRecipientId: string | null;
  otherParticipant: ConversationParticipant | null;
  participants: ConversationParticipant[];
  title: string;
  unread: number;
  planRelated?: boolean;
  lastMessage: string;
  lastTime: string;
  latestMessage: Message | null;
  messages: Message[];
};

export type MessageCursor = {
  createdAt: string;
  id: string;
};

export type MessagePage = {
  messages: Message[];
  hasMore: boolean;
  nextCursor: MessageCursor | null;
};
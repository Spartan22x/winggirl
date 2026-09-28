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

export type PlanStatus = 'upcoming' | 'invited' | 'past' | 'joined';

export type PlanItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  startsAt: string;
  activity: string;
  status: PlanStatus;
  attendees: string[];
  location: string;
  host: string;
  note: string;
};

export type Message = {
  id: string;
  sender: string;
  text: string;
  time: string;
  me?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  participants: string[];
  unread: number;
  planRelated?: boolean;
  lastMessage: string;
  lastTime: string;
  messages: Message[];
};
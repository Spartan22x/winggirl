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

export const currentUser = {
  firstName: 'Amanda',
  age: 29,
  bio: 'Always down for a relaxed plan, a good conversation, and a neighborhood spot that feels easy.',
  interests: ['Wellness', 'Coffee', 'Art walks', 'Live music'],
  connections: 48,
  avatarColor: '#172535',
};

export const mockUsers: UserProfile[] = [
  {
    id: 'user-1',
    firstName: 'Jules',
    age: 28,
    distance: '0.8 mi',
    interests: ['Coffee', 'Museums', 'Books'],
    available: true,
    bio: 'Loves slow mornings and a good recommendation list.',
    connections: 18,
    avatarColor: '#F5D4C8',
    activity: 'Coffee',
    friends: 3,
    friendsOfFriends: true,
  },
  {
    id: 'user-2',
    firstName: 'Nina',
    age: 30,
    distance: '1.2 mi',
    interests: ['Walks', 'Brunch', 'Yoga'],
    available: true,
    bio: 'Always planning a thoughtful catch-up and a low-key good time.',
    connections: 26,
    avatarColor: '#E8D9C2',
    activity: 'Walk',
    friends: 5,
    friendsOfFriends: true,
  },
  {
    id: 'user-3',
    firstName: 'Rachel',
    age: 31,
    distance: '2.0 mi',
    interests: ['Live music', 'Dinner', 'Shopping'],
    available: false,
    bio: 'Big on warm ambiance and a little spontaneity after work.',
    connections: 36,
    avatarColor: '#D9D7F5',
    activity: 'Live music',
    friends: 2,
    friendsOfFriends: false,
  },
  {
    id: 'user-4',
    firstName: 'Sasha',
    age: 27,
    distance: '1.5 mi',
    interests: ['Fitness', 'Suppers', 'Pilates'],
    available: true,
    bio: 'A balanced mix of energy and easy conversation.',
    connections: 22,
    avatarColor: '#D7E8D9',
    activity: 'Fitness',
    friends: 4,
    friendsOfFriends: true,
  },
  {
    id: 'user-5',
    firstName: 'Leah',
    age: 32,
    distance: '3.1 mi',
    interests: ['Cocktails', 'Art', 'Dining'],
    available: true,
    bio: 'Enjoys a thoughtful plan with great music and good people.',
    connections: 40,
    avatarColor: '#E7D3E8',
    activity: 'Drinks',
    friends: 7,
    friendsOfFriends: true,
  },
  {
    id: 'user-6',
    firstName: 'Mila',
    age: 29,
    distance: '2.6 mi',
    interests: ['Coffee', 'Books', 'Brunch'],
    available: true,
    bio: 'Happy to turn a casual question into a great evening plan.',
    connections: 29,
    avatarColor: '#CFE5F7',
    activity: 'Coffee',
    friends: 6,
    friendsOfFriends: false,
  },
];

export const mockActivities = ['Dinner', 'Drinks', 'Coffee', 'Fitness', 'Walk', 'Live music', 'Shopping', 'Something spontaneous'];

export const mockLocations = [
  { name: 'Rosewood Café', area: 'Downtown', vibe: 'Warm, low-key', note: 'Great for coffee or a quick catch-up' },
  { name: 'Marlow Wine Bar', area: 'The Village', vibe: 'Lively but relaxed', note: 'Easy for a first plan' },
  { name: 'Luna Park Trail', area: 'Riverside', vibe: 'Open and breezy', note: 'Perfect for a walk plus coffee' },
  { name: 'Sora Kitchen', area: 'Old Town', vibe: 'Cozy and social', note: 'A go-to dinner spot' },
  { name: 'Cinder & Co.', area: 'Arts District', vibe: 'Creative and buzzing', note: 'Good for live music and friends' },
];

export const initialPlans: PlanItem[] = [
  {
    id: 'plan-1',
    title: 'Sunset walk + coffee',
    date: 'Thu, Sep 26',
    time: '6:30 PM',
    activity: 'Walk',
    status: 'upcoming',
    attendees: ['Jules', 'Nina'],
    location: 'Luna Park Trail',
    host: 'Amanda',
    note: 'A low-key evening before dinner.',
  },
  {
    id: 'plan-2',
    title: 'Wine bar catch-up',
    date: 'Sat, Sep 28',
    time: '8:00 PM',
    activity: 'Drinks',
    status: 'invited',
    attendees: ['Leah', 'Rachel'],
    location: 'Marlow Wine Bar',
    host: 'Maya',
    note: 'One of those easy, happy little plans.',
  },
  {
    id: 'plan-3',
    title: 'Sunday brunch',
    date: 'Sun, Sep 22',
    time: '10:30 AM',
    activity: 'Coffee',
    status: 'past',
    attendees: ['Mila', 'Jules'],
    location: 'Rosewood Café',
    host: 'Amanda',
    note: 'A slow morning spent catching up.',
  },
];

export const initialConversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Jules',
    participants: ['Jules'],
    unread: 2,
    lastMessage: 'I’m in for a coffee before the show.',
    lastTime: '2m ago',
    messages: [
      { id: 'm1', sender: 'Jules', text: 'Hi! Want to grab coffee before the show?', time: '6:42 PM' },
      { id: 'm2', sender: 'me', text: 'Yes, that sounds perfect.', time: '6:43 PM', me: true },
      { id: 'm3', sender: 'Jules', text: 'I’m in for a coffee before the show.', time: '6:45 PM' },
    ],
  },
  {
    id: 'conv-2',
    title: 'Sunset walk group',
    participants: ['Jules', 'Nina', 'Amanda'],
    unread: 0,
    planRelated: true,
    lastMessage: 'Let’s meet at the north gate and walk over.',
    lastTime: '18m ago',
    messages: [
      { id: 'g1', sender: 'Nina', text: 'If we leave at 6:30, we can still get coffee after.', time: '5:32 PM' },
      { id: 'g2', sender: 'me', text: 'Perfect. I’ll meet you at the north gate.', time: '5:34 PM', me: true },
      { id: 'g3', sender: 'Jules', text: 'Let’s meet at the north gate and walk over.', time: '5:36 PM' },
    ],
  },
  {
    id: 'conv-3',
    title: 'Mila',
    participants: ['Mila'],
    unread: 1,
    lastMessage: 'I loved that book recommendation.',
    lastTime: '1h ago',
    messages: [
      { id: 'm4', sender: 'Mila', text: 'I loved that book recommendation.', time: 'yesterday' },
      { id: 'm5', sender: 'me', text: 'I’m glad! I think you’d love this new one too.', time: 'yesterday', me: true },
    ],
  },
];

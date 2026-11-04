import {
  createGroupConversation,
  getConversations,
  sendMessage,
  startDirectConversation,
} from '@/src/data/api';
import { supabase } from '@/src/lib/supabase';

type MockResponse = {
  data: unknown;
  error: Error | null;
};

type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

const mockResponses = new Map<string, MockResponse[]>();
const mockQueryCalls: QueryCall[] = [];
const mockRpcResponses: MockResponse[] = [];
const mockSupabase = supabase as unknown as {
  from: jest.Mock;
  rpc: jest.Mock;
};

class MockQuery {
  constructor(
    private readonly table: string,
    private readonly response: MockResponse,
  ) {}

  select(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'select', args });
    return this;
  }

  eq(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'eq', args });
    return this;
  }

  in(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'in', args });
    return this;
  }

  order(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'order', args });
    return this;
  }

  insert(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'insert', args });
    return this;
  }

  then<TResult1 = MockResponse, TResult2 = never>(
    onfulfilled?: ((value: MockResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

function queueResponse(table: string, response: MockResponse) {
  const responses = mockResponses.get(table) ?? [];
  responses.push(response);
  mockResponses.set(table, responses);
}

function queueRpcResponse(response: MockResponse) {
  mockRpcResponses.push(response);
}

function getCalls(table: string, method: string) {
  return mockQueryCalls.filter((call) => call.table === table && call.method === method);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResponses.clear();
  mockQueryCalls.length = 0;
  mockRpcResponses.length = 0;
  mockSupabase.from.mockImplementation((table: string) => {
    const response = mockResponses.get(table)?.shift() ?? { data: [], error: null };
    return new MockQuery(table, response);
  });
  mockSupabase.rpc.mockImplementation(() => Promise.resolve(
    mockRpcResponses.shift() ?? { data: null, error: null },
  ));
});

describe('startDirectConversation', () => {
  it('calls the direct-conversation RPC with the target profile ID and returns its conversation ID', async () => {
    queueRpcResponse({ data: 'direct-conversation-id', error: null });

    await expect(startDirectConversation('target-profile-id'))
      .resolves.toBe('direct-conversation-id');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('start_direct_conversation', {
      target_profile_id: 'target-profile-id',
    });
  });

  it('propagates direct-conversation RPC errors', async () => {
    const error = new Error('Direct conversation unavailable');
    queueRpcResponse({ data: null, error });

    await expect(startDirectConversation('target-profile-id')).rejects.toBe(error);
  });
});

describe('createGroupConversation', () => {
  it('calls the plan-based group RPC with its member and plan arguments and returns its conversation ID', async () => {
    queueRpcResponse({ data: 'group-conversation-id', error: null });

    await expect(createGroupConversation(
      ['member-a', 'member-b', 'member-c'],
      'eligible-plan-id',
    )).resolves.toBe('group-conversation-id');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_group_conversation', {
      member_profile_ids: ['member-a', 'member-b', 'member-c'],
      target_plan_id: 'eligible-plan-id',
    });
  });

  it('propagates group-conversation RPC errors', async () => {
    const error = new Error('Group creation denied');
    queueRpcResponse({ data: null, error });

    await expect(createGroupConversation(
      ['member-a', 'member-b', 'member-c'],
      'eligible-plan-id',
    )).rejects.toBe(error);
  });
});

describe('getConversations', () => {
  it('loads the profile memberships and uses those IDs for conversation and ordered message queries', async () => {
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-1' }, { conversation_id: 'conversation-2' }],
      error: null,
    });
    queueResponse('conversations', { data: [], error: null });
    queueResponse('messages', { data: [], error: null });

    await expect(getConversations('current-profile')).resolves.toEqual([]);

    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'conversation_members');
    expect(getCalls('conversation_members', 'select').map((call) => call.args)).toEqual([
      ['conversation_id'],
    ]);
    expect(getCalls('conversation_members', 'eq').map((call) => call.args)).toEqual([
      ['profile_id', 'current-profile'],
    ]);
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'conversations');
    expect(getCalls('conversations', 'select').map((call) => call.args)).toEqual([
      ['id, created_by, plan_id, conversation_type, direct_recipient_id'],
    ]);
    expect(getCalls('conversations', 'in').map((call) => call.args)).toEqual([
      ['id', ['conversation-1', 'conversation-2']],
    ]);
    expect(mockSupabase.from).toHaveBeenNthCalledWith(3, 'messages');
    expect(getCalls('messages', 'select').map((call) => call.args)).toEqual([
      ['id, conversation_id, sender_id, body, created_at'],
    ]);
    expect(getCalls('messages', 'in').map((call) => call.args)).toEqual([
      ['conversation_id', ['conversation-1', 'conversation-2']],
    ]);
    expect(getCalls('messages', 'order').map((call) => call.args)).toEqual([
      ['created_at'],
    ]);
  });

  it('returns an empty list without querying conversations or messages when there are no memberships', async () => {
    queueResponse('conversation_members', { data: [], error: null });

    await expect(getConversations('current-profile')).resolves.toEqual([]);

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('conversation_members');
  });

  it('maps messages, sender names, first non-self sender title, and the latest ordered message', async () => {
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-1' }],
      error: null,
    });
    queueResponse('conversations', {
      data: [
        {
          id: 'conversation-1',
          created_by: 'current-profile',
          plan_id: 'plan-1',
          conversation_type: 'direct',
          direct_recipient_id: 'friend-1',
        },
        {
          id: 'conversation-without-plan',
          created_by: 'current-profile',
          plan_id: null,
          conversation_type: 'group',
          direct_recipient_id: null,
        },
      ],
      error: null,
    });
    queueResponse('messages', {
      data: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          sender_id: 'friend-1',
          body: 'Hello',
          created_at: '2026-04-05T13:00:00.000Z',
        },
        {
          id: 'message-2',
          conversation_id: 'conversation-1',
          sender_id: 'current-profile',
          body: 'Hi there',
          created_at: '2026-04-05T13:01:00.000Z',
        },
        {
          id: 'message-3',
          conversation_id: 'conversation-1',
          sender_id: 'friend-2',
          body: 'See you soon',
          created_at: '2026-04-05T13:02:00.000Z',
        },
      ],
      error: null,
    });
    queueResponse('profiles', {
      data: [
        { id: 'friend-1', first_name: 'Alex' },
        { id: 'friend-2', first_name: 'Blair' },
      ],
      error: null,
    });

    const conversations = await getConversations('current-profile');

    expect(mockSupabase.from.mock.calls.map(([table]) => table)).toEqual([
      'conversation_members',
      'conversations',
      'messages',
      'profiles',
    ]);
    expect(getCalls('profiles', 'select').map((call) => call.args)).toEqual([
      ['id, first_name'],
    ]);
    expect(getCalls('profiles', 'in').map((call) => call.args)).toEqual([
      ['id', ['friend-1', 'current-profile', 'friend-2']],
    ]);
    expect(conversations).toEqual([
      {
        id: 'conversation-1',
        createdBy: 'current-profile',
        planId: 'plan-1',
        conversationType: 'direct',
        directRecipientId: 'friend-1',
        title: 'Alex',
        unread: 0,
        planRelated: true,
        lastMessage: 'See you soon',
        lastTime: new Date('2026-04-05T13:02:00.000Z').toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        }),
        messages: [
          {
            id: 'message-1',
            sender: 'Alex',
            text: 'Hello',
            time: new Date('2026-04-05T13:00:00.000Z').toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            }),
            me: false,
          },
          {
            id: 'message-2',
            sender: 'Wing',
            text: 'Hi there',
            time: new Date('2026-04-05T13:01:00.000Z').toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            }),
            me: true,
          },
          {
            id: 'message-3',
            sender: 'Blair',
            text: 'See you soon',
            time: new Date('2026-04-05T13:02:00.000Z').toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            }),
            me: false,
          },
        ],
      },
      {
        id: 'conversation-without-plan',
        createdBy: 'current-profile',
        planId: null,
        conversationType: 'group',
        directRecipientId: null,
        title: 'Conversation',
        unread: 0,
        planRelated: false,
        lastMessage: '',
        lastTime: '',
        messages: [],
      },
    ]);
  });

  it('looks up each sender profile ID only once and falls back when a sender profile is missing', async () => {
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-2' }],
      error: null,
    });
    queueResponse('conversations', {
      data: [{
        id: 'conversation-2',
        created_by: 'current-profile',
        plan_id: null,
        conversation_type: 'direct',
        direct_recipient_id: 'friend-2',
      }],
      error: null,
    });
    queueResponse('messages', {
      data: [
        {
          id: 'message-4',
          conversation_id: 'conversation-2',
          sender_id: 'unknown-sender',
          body: 'First',
          created_at: '2026-04-05T14:00:00.000Z',
        },
        {
          id: 'message-5',
          conversation_id: 'conversation-2',
          sender_id: 'unknown-sender',
          body: 'Latest',
          created_at: '2026-04-05T14:01:00.000Z',
        },
      ],
      error: null,
    });
    queueResponse('profiles', { data: [], error: null });

    const conversations = await getConversations('current-profile');

    expect(getCalls('profiles', 'in').map((call) => call.args)).toEqual([
      ['id', ['unknown-sender']],
    ]);
    expect(conversations[0]).toMatchObject({
      conversationType: 'direct',
      directRecipientId: 'friend-2',
      title: 'Wing',
      lastMessage: 'Latest',
      messages: [
        { sender: 'Wing', text: 'First' },
        { sender: 'Wing', text: 'Latest' },
      ],
    });
  });

  it('skips profile lookup when messages have no sender IDs and maps empty conversation messages', async () => {
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-3' }],
      error: null,
    });
    queueResponse('conversations', {
      data: [{
        id: 'conversation-3',
        created_by: 'current-profile',
        plan_id: null,
        conversation_type: 'group',
        direct_recipient_id: null,
      }],
      error: null,
    });
    queueResponse('messages', { data: [], error: null });

    await expect(getConversations('current-profile')).resolves.toEqual([
      {
        id: 'conversation-3',
        createdBy: 'current-profile',
        planId: null,
        conversationType: 'group',
        directRecipientId: null,
        title: 'Conversation',
        unread: 0,
        planRelated: false,
        lastMessage: '',
        lastTime: '',
        messages: [],
      },
    ]);
    expect(mockSupabase.from).toHaveBeenCalledTimes(3);
  });

  it('propagates membership lookup errors and stops before other queries', async () => {
    const error = new Error('Membership lookup failed');
    queueResponse('conversation_members', { data: null, error });

    await expect(getConversations('current-profile')).rejects.toBe(error);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['conversations', 'Conversation lookup failed'],
    ['messages', 'Message lookup failed'],
  ] as const)('propagates %s query errors', async (table, message) => {
    const error = new Error(message);
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-4' }],
      error: null,
    });
    queueResponse('conversations', {
      data: [],
      error: table === 'conversations' ? error : null,
    });
    queueResponse('messages', {
      data: [],
      error: table === 'messages' ? error : null,
    });

    await expect(getConversations('current-profile')).rejects.toBe(error);
  });

  it('propagates sender profile lookup errors', async () => {
    const error = new Error('Sender lookup failed');
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-5' }],
      error: null,
    });
    queueResponse('conversations', {
      data: [{
        id: 'conversation-5',
        created_by: 'current-profile',
        plan_id: null,
        conversation_type: 'group',
        direct_recipient_id: null,
      }],
      error: null,
    });
    queueResponse('messages', {
      data: [{
        id: 'message-6',
        conversation_id: 'conversation-5',
        sender_id: 'sender-5',
        body: 'A message',
        created_at: '2026-04-05T15:00:00.000Z',
      }],
      error: null,
    });
    queueResponse('profiles', { data: null, error });

    await expect(getConversations('current-profile')).rejects.toBe(error);
  });

  it('returns an empty list when no conversations are returned', async () => {
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-6' }],
      error: null,
    });
    queueResponse('conversations', { data: [], error: null });
    queueResponse('messages', { data: [], error: null });

    await expect(getConversations('current-profile')).resolves.toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledTimes(3);
  });
});

describe('sendMessage', () => {
  it('inserts a message with the provided sender, conversation, and body and resolves undefined', async () => {
    queueResponse('messages', { data: null, error: null });

    await expect(sendMessage('sender-profile', 'conversation-7', '  Hello there  '))
      .resolves.toBeUndefined();

    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
    expect(getCalls('messages', 'insert').map((call) => call.args)).toEqual([
      [{
        conversation_id: 'conversation-7',
        sender_id: 'sender-profile',
        body: '  Hello there  ',
      }],
    ]);
  });

  it('propagates message insert errors', async () => {
    const error = new Error('Message insert failed');
    queueResponse('messages', { data: null, error });

    await expect(sendMessage('sender-profile', 'conversation-8', 'Message body'))
      .rejects.toBe(error);
  });
});

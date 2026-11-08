import {
  createGroupConversation,
  getConversationMessages,
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
  auth: { getUser: jest.Mock };
  from: jest.Mock;
  rpc: jest.Mock;
};
let mockAuthenticatedUserId = 'current-profile';

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

  or(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'or', args });
    return this;
  }

  order(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'order', args });
    return this;
  }

  limit(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'limit', args });
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
    auth: { getUser: jest.fn() },
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

function messageRow(
  id: string,
  createdAt: string,
  senderId = 'current-profile',
  body = id,
) {
  return {
    id,
    conversation_id: 'conversation-1',
    sender_id: senderId,
    body,
    created_at: createdAt,
    profiles: senderId === 'current-profile' ? { first_name: 'Me' } : { first_name: 'Other' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResponses.clear();
  mockQueryCalls.length = 0;
  mockRpcResponses.length = 0;
  mockAuthenticatedUserId = 'current-profile';
  mockSupabase.auth.getUser.mockImplementation(async () => ({
    data: { user: { id: mockAuthenticatedUserId } },
    error: null,
  }));
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
  it('calls the group RPC with invitees only and returns its conversation ID', async () => {
    queueRpcResponse({ data: 'group-conversation-id', error: null });

    await expect(createGroupConversation(['invitee-a', 'invitee-b']))
      .resolves.toBe('group-conversation-id');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_group_conversation', {
      invitee_profile_ids: ['invitee-a', 'invitee-b'],
    });
  });

  it('propagates group-conversation RPC errors', async () => {
    const error = new Error('Group creation denied');
    queueRpcResponse({ data: null, error });

    await expect(createGroupConversation(['invitee-a', 'invitee-b'])).rejects.toBe(error);
  });
});

describe('getConversations', () => {
  it('uses the authenticated identity and fetches only visible participant summaries and each latest message', async () => {
    mockAuthenticatedUserId = 'authenticated-profile';
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-1' }, { conversation_id: 'conversation-2' }],
      error: null,
    });
    queueResponse('conversations', { data: [], error: null });

    await expect(getConversations('forged-profile')).resolves.toEqual([]);

    expect(getCalls('conversation_members', 'eq')).toEqual([
      { table: 'conversation_members', method: 'eq', args: ['profile_id', 'authenticated-profile'] },
    ]);
    const select = String(getCalls('conversations', 'select')[0].args[0]).replace(/\s+/g, ' ');
    expect(select).toContain('conversation_members( profile_id, profiles(first_name, avatar_color) )');
    expect(select).toContain('messages(id, conversation_id, sender_id, body, created_at)');
    expect(getCalls('conversations', 'order')).toEqual([
      {
        table: 'conversations',
        method: 'order',
        args: ['created_at', { ascending: false, referencedTable: 'messages' }],
      },
      {
        table: 'conversations',
        method: 'order',
        args: ['id', { ascending: false, referencedTable: 'messages' }],
      },
    ]);
    expect(getCalls('conversations', 'limit')).toEqual([
      {
        table: 'conversations',
        method: 'limit',
        args: [1, { referencedTable: 'messages' }],
      },
    ]);
    expect(mockSupabase.from).not.toHaveBeenCalledWith('messages');
  });

  it('maps direct recipient, actual profile title, latest preview, and missing images', async () => {
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'direct-1' }],
      error: null,
    });
    queueResponse('conversations', {
      data: [{
        id: 'direct-1',
        created_by: 'authenticated-user',
        plan_id: null,
        conversation_type: 'direct',
        direct_recipient_id: 'friend-1',
        conversation_members: [
          {
            profile_id: 'authenticated-user',
            profiles: { first_name: 'Me', avatar_color: '#111111' },
          },
          {
            profile_id: 'friend-1',
            profiles: { first_name: 'Alex', avatar_color: '#222222' },
          },
        ],
        messages: [{
          id: 'message-latest',
          conversation_id: 'direct-1',
          sender_id: 'authenticated-user',
          body: 'Latest reply',
          created_at: '2026-04-05T13:02:00.000Z',
        }],
      }],
      error: null,
    });
    mockAuthenticatedUserId = 'authenticated-user';

    const [conversation] = await getConversations();
    expect(conversation).toMatchObject({
      id: 'direct-1',
      conversationType: 'direct',
      directRecipientId: 'friend-1',
      title: 'Alex',
      otherParticipant: {
        profileId: 'friend-1',
        firstName: 'Alex',
        profileImageUrl: null,
        avatarColor: '#222222',
      },
      participants: [
        {
          profileId: 'authenticated-user',
          firstName: 'Me',
          profileImageUrl: null,
        },
        {
          profileId: 'friend-1',
          firstName: 'Alex',
          profileImageUrl: null,
        },
      ],
      lastMessage: 'Latest reply',
      latestMessage: {
        id: 'message-latest',
        conversationId: 'direct-1',
        senderId: 'authenticated-user',
        sender: 'Me',
        text: 'Latest reply',
        me: true,
      },
      messages: [{ id: 'message-latest', text: 'Latest reply' }],
    });
    expect(conversation.lastTime).toBe(new Date('2026-04-05T13:02:00.000Z')
      .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
  });

  it('returns all RLS-visible group participants without inventing a group name', async () => {
    mockAuthenticatedUserId = 'member-a';
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'group-1' }],
      error: null,
    });
    queueResponse('conversations', {
      data: [{
        id: 'group-1',
        created_by: 'member-a',
        plan_id: 'plan-1',
        conversation_type: 'group',
        direct_recipient_id: null,
        conversation_members: [
          { profile_id: 'member-a', profiles: { first_name: 'Ari', avatar_color: '#111111' } },
          { profile_id: 'member-b', profiles: null },
          { profile_id: 'member-c', profiles: { first_name: 'Casey', avatar_color: '#333333' } },
        ],
        messages: [],
      }],
      error: null,
    });

    const [conversation] = await getConversations();
    expect(conversation).toMatchObject({
      conversationType: 'group',
      title: 'Group conversation',
      otherParticipant: null,
      participants: [
        { profileId: 'member-a', firstName: 'Ari', profileImageUrl: null },
        { profileId: 'member-b', firstName: null, profileImageUrl: null },
        { profileId: 'member-c', firstName: 'Casey', profileImageUrl: null },
      ],
      latestMessage: null,
      lastMessage: '',
      lastTime: '',
      messages: [],
    });
  });

  it('orders newest activity first, breaks equal activity timestamps by message ID, and places empty conversations last', async () => {
    mockAuthenticatedUserId = 'current-profile';
    queueResponse('conversation_members', {
      data: ['older', 'empty-b', 'same-a', 'newest', 'empty-a', 'same-b']
        .map((conversation_id) => ({ conversation_id })),
      error: null,
    });
    const conversation = (
      id: string,
      messages: { id: string; created_at: string }[],
    ) => ({
      id,
      created_by: 'current-profile',
      plan_id: null,
      conversation_type: 'group',
      direct_recipient_id: null,
      conversation_members: [{ profile_id: 'current-profile', profiles: null }],
      messages: messages.map(({ id: messageId, created_at }) => ({
        id: messageId,
        conversation_id: id,
        sender_id: 'current-profile',
        body: messageId,
        created_at,
      })),
    });
    queueResponse('conversations', {
      data: [
        conversation('older', [{ id: 'message-older', created_at: '2026-04-05T12:00:00.000Z' }]),
        conversation('empty-b', []),
        conversation('same-a', [{ id: '00000000-0000-4000-8000-000000000001', created_at: '2026-04-05T13:00:00.000Z' }]),
        conversation('newest', [{ id: 'message-newest', created_at: '2026-04-05T14:00:00.000Z' }]),
        conversation('empty-a', []),
        conversation('same-b', [{ id: '00000000-0000-4000-8000-000000000002', created_at: '2026-04-05T13:00:00.000Z' }]),
      ],
      error: null,
    });

    const result = await getConversations();
    expect(result.map(({ id }) => id)).toEqual([
      'newest',
      'same-b',
      'same-a',
      'older',
      'empty-b',
      'empty-a',
    ]);
  });

  it('returns an empty list without querying conversation details when there are no memberships', async () => {
    queueResponse('conversation_members', { data: [], error: null });

    await expect(getConversations()).resolves.toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it('propagates membership and conversation query errors', async () => {
    const membershipError = new Error('Membership lookup failed');
    queueResponse('conversation_members', { data: null, error: membershipError });
    await expect(getConversations()).rejects.toBe(membershipError);

    const conversationError = new Error('Conversation lookup failed');
    queueResponse('conversation_members', {
      data: [{ conversation_id: 'conversation-1' }],
      error: null,
    });
    queueResponse('conversations', { data: null, error: conversationError });
    await expect(getConversations()).rejects.toBe(conversationError);
  });
});

describe('getConversationMessages', () => {
  it('returns the first page in chronological order with a cursor when older messages exist', async () => {
    queueResponse('messages', {
      data: [
        messageRow('00000000-0000-4000-8000-000000000005', '2026-04-05T13:02:00.000Z'),
        messageRow('00000000-0000-4000-8000-000000000004', '2026-04-05T13:01:00.000Z'),
        messageRow('00000000-0000-4000-8000-000000000003', '2026-04-05T13:00:00.000Z'),
      ],
      error: null,
    });

    await expect(getConversationMessages('conversation-1', { pageSize: 2 })).resolves.toMatchObject({
      messages: [
        { id: '00000000-0000-4000-8000-000000000004' },
        { id: '00000000-0000-4000-8000-000000000005' },
      ],
      hasMore: true,
      nextCursor: {
        id: '00000000-0000-4000-8000-000000000004',
        createdAt: '2026-04-05T13:01:00.000Z',
      },
    });
    expect(getCalls('messages', 'order').map(({ args }) => args)).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(getCalls('messages', 'limit').map(({ args }) => args)).toEqual([[3]]);
  });

  it('requests the next page using a stable timestamp-and-ID keyset cursor', async () => {
    const before = {
      createdAt: '2026-04-05T13:00:00.000Z',
      id: '00000000-0000-4000-8000-000000000003',
    };
    queueResponse('messages', {
      data: [
        messageRow('00000000-0000-4000-8000-000000000002', before.createdAt),
        messageRow('00000000-0000-4000-8000-000000000001', before.createdAt),
      ],
      error: null,
    });

    await expect(getConversationMessages('conversation-1', { pageSize: 2, before }))
      .resolves.toMatchObject({
        messages: [
          { id: '00000000-0000-4000-8000-000000000001' },
          { id: '00000000-0000-4000-8000-000000000002' },
        ],
        hasMore: false,
        nextCursor: null,
      });
    expect(getCalls('messages', 'or').map(({ args }) => args)).toEqual([[
      `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`,
    ]]);
  });

  it('handles an empty history', async () => {
    queueResponse('messages', { data: [], error: null });
    await expect(getConversationMessages('conversation-1')).resolves.toEqual({
      messages: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it.each([0, -1, 1.5, 101])('rejects invalid page size %s before querying messages', async (pageSize) => {
    await expect(getConversationMessages('conversation-1', { pageSize }))
      .rejects.toThrow(RangeError);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('rejects malformed cursors before querying messages', async () => {
    await expect(getConversationMessages('conversation-1', {
      before: { createdAt: 'not-a-date', id: 'not-a-uuid' },
    })).rejects.toThrow('The message pagination cursor is invalid.');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('propagates RLS/query errors', async () => {
    const error = new Error('Message history denied');
    queueResponse('messages', { data: null, error });
    await expect(getConversationMessages('conversation-1')).rejects.toBe(error);
  });
});

describe('sendMessage', () => {
  it('uses the authenticated sender and ignores a legacy caller-supplied profile ID', async () => {
    mockAuthenticatedUserId = 'authenticated-sender';
    queueResponse('messages', { data: null, error: null });

    await expect(sendMessage('forged-sender', 'conversation-7', '  Hello there  '))
      .resolves.toBeUndefined();

    expect(getCalls('messages', 'insert').map(({ args }) => args)).toEqual([
      [{
        conversation_id: 'conversation-7',
        sender_id: 'authenticated-sender',
        body: '  Hello there  ',
      }],
    ]);
  });

  it('supports sending without a caller-supplied identity', async () => {
    queueResponse('messages', { data: null, error: null });
    await sendMessage('conversation-8', 'Message body');
    expect(getCalls('messages', 'insert')[0].args[0]).toEqual({
      conversation_id: 'conversation-8',
      sender_id: 'current-profile',
      body: 'Message body',
    });
  });

  it('propagates message insert errors', async () => {
    const error = new Error('Message insert failed');
    queueResponse('messages', { data: null, error });
    await expect(sendMessage('conversation-8', 'Message body')).rejects.toBe(error);
  });

  it('propagates authentication failures', async () => {
    const error = new Error('Session lookup failed');
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error,
    });
    await expect(sendMessage('conversation-8', 'Message body')).rejects.toBe(error);
  });
});

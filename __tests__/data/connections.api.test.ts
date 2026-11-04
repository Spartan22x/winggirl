import {
  getAcceptedConnections,
  getConnectionStatus,
  getIncomingConnectionRequests,
  respondToConnectionRequest,
  sendConnectionRequest,
} from '@/src/data/api';
import { supabase } from '@/src/lib/supabase';

type MockResponse = {
  data: unknown;
  error: Error | null;
  count?: number | null;
};

type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

const mockResponses = new Map<string, MockResponse[]>();
const mockQueryCalls: QueryCall[] = [];
const mockSupabase = supabase as unknown as {
  auth: { getUser: jest.Mock };
  rpc: jest.Mock;
  from: jest.Mock;
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

  order(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'order', args });
    return this;
  }

  or(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'or', args });
    return this;
  }

  in(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'in', args });
    return this;
  }

  maybeSingle() {
    mockQueryCalls.push({ table: this.table, method: 'maybeSingle', args: [] });
    return Promise.resolve(this.response);
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
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

function queueResponse(table: string, response: MockResponse) {
  const responses = mockResponses.get(table) ?? [];
  responses.push(response);
  mockResponses.set(table, responses);
}

function makeProfile(id: string, overrides: Partial<{
  first_name: string;
  age: number | null;
  bio: string | null;
  avatar_color: string;
}> = {}) {
  return {
    id,
    first_name: overrides.first_name ?? `Name ${id}`,
    age: overrides.age === undefined ? 31 : overrides.age,
    bio: overrides.bio === undefined ? 'A public bio' : overrides.bio,
    avatar_color: overrides.avatar_color ?? '#123456',
  };
}

function getCalls(table: string, method: string) {
  return mockQueryCalls.filter((call) => call.table === table && call.method === method);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResponses.clear();
  mockQueryCalls.length = 0;
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'current-user' } },
    error: null,
  });
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  mockSupabase.from.mockImplementation((table: string) => {
    const response = mockResponses.get(table)?.shift() ?? { data: [], error: null };
    return new MockQuery(table, response);
  });
});

describe('connection request RPC functions', () => {
  it.each(['requested', 'outgoing_pending', 'incoming_pending', 'connected'])(
    'sends a request using the target_profile_id argument and returns %s',
    async (result) => {
      mockSupabase.rpc.mockResolvedValue({ data: result, error: null });

      await expect(sendConnectionRequest('target-user')).resolves.toBe(result);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('request_connection', {
        target_profile_id: 'target-user',
      });
    },
  );

  it('propagates errors returned by the request RPC', async () => {
    const error = new Error('RPC failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error });

    await expect(sendConnectionRequest('target-user')).rejects.toBe(error);
  });

  it('rejects an unexpected request RPC result', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'declined', error: null });

    await expect(sendConnectionRequest('target-user')).rejects.toThrow(
      'The connection request returned an unexpected result.',
    );
  });

  it.each([
    { accept: true, result: 'accepted' },
    { accept: false, result: 'declined' },
  ])('responds to requester with accept=$accept and returns $result', async ({ accept, result }) => {
    mockSupabase.rpc.mockResolvedValue({ data: result, error: null });

    await expect(respondToConnectionRequest('requester-user', accept)).resolves.toBe(result);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('respond_to_connection', {
      requester_profile_id: 'requester-user',
      accept_request: accept,
    });
  });

  it('propagates errors returned by the response RPC', async () => {
    const error = new Error('Response RPC failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error });

    await expect(respondToConnectionRequest('requester-user', true)).rejects.toBe(error);
  });

  it.each([
    { accept: true, data: 'declined' },
    { accept: false, data: 'accepted' },
    { accept: true, data: 'unexpected' },
  ])('rejects a response result that does not match accept=$accept', async ({ accept, data }) => {
    mockSupabase.rpc.mockResolvedValue({ data, error: null });

    await expect(respondToConnectionRequest('requester-user', accept)).rejects.toThrow(
      'The connection response returned an unexpected result.',
    );
  });
});

describe('getIncomingConnectionRequests', () => {
  it('uses the authenticated user, selects incoming pending rows, and maps requester profiles', async () => {
    queueResponse('connections', {
      data: [
        {
          requester_id: 'requester-1',
          addressee_id: 'current-user',
          status: 'pending',
          created_at: '2026-01-02T03:04:05.000Z',
          updated_at: '2026-01-02T03:04:05.000Z',
        },
      ],
      error: null,
    });
    queueResponse('profiles', {
      data: [makeProfile('requester-1', { age: null, bio: null })],
      error: null,
    });

    await expect(getIncomingConnectionRequests()).resolves.toEqual([
      {
        requesterId: 'requester-1',
        createdAt: '2026-01-02T03:04:05.000Z',
        profile: {
          id: 'requester-1',
          firstName: 'Name requester-1',
          age: null,
          bio: '',
          avatarColor: '#123456',
        },
      },
    ]);

    expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(getCalls('connections', 'eq').map((call) => call.args)).toEqual([
      ['addressee_id', 'current-user'],
      ['status', 'pending'],
    ]);
    expect(getCalls('connections', 'order').map((call) => call.args)).toEqual([
      ['created_at', { ascending: false }],
    ]);
    expect(getCalls('profiles', 'in').map((call) => call.args)).toEqual([
      ['id', ['requester-1']],
    ]);
  });

  it('returns a null profile when a requester profile row is missing', async () => {
    queueResponse('connections', {
      data: [{
        requester_id: 'deleted-requester',
        addressee_id: 'current-user',
        status: 'pending',
        created_at: '2026-01-02T03:04:05.000Z',
        updated_at: '2026-01-02T03:04:05.000Z',
      }],
      error: null,
    });
    queueResponse('profiles', { data: [], error: null });

    const requests = await getIncomingConnectionRequests();

    expect(requests).toHaveLength(1);
    expect(requests[0].profile).toBeNull();
  });

  it('returns an empty list without querying profiles when there are no requests', async () => {
    queueResponse('connections', { data: [], error: null });

    await expect(getIncomingConnectionRequests()).resolves.toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it('propagates connection and profile query errors', async () => {
    const connectionError = new Error('Connections query failed');
    queueResponse('connections', { data: null, error: connectionError });
    await expect(getIncomingConnectionRequests()).rejects.toBe(connectionError);

    mockResponses.clear();
    const profileError = new Error('Profiles query failed');
    queueResponse('connections', {
      data: [{
        requester_id: 'requester-1',
        addressee_id: 'current-user',
        status: 'pending',
        created_at: '2026-01-02T03:04:05.000Z',
        updated_at: '2026-01-02T03:04:05.000Z',
      }],
      error: null,
    });
    queueResponse('profiles', { data: null, error: profileError });
    await expect(getIncomingConnectionRequests()).rejects.toBe(profileError);
  });

  it('throws when no authenticated user is available', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getIncomingConnectionRequests()).rejects.toThrow(
      'You must be signed in to access connections.',
    );
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('propagates authentication lookup errors', async () => {
    const error = new Error('Authentication lookup failed');
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error });

    await expect(getIncomingConnectionRequests()).rejects.toBe(error);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('getAcceptedConnections', () => {
  it('maps the other participant when the current user sent the request', async () => {
    queueResponse('connections', {
      data: [{
        requester_id: 'current-user',
        addressee_id: 'other-user',
        status: 'accepted',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      }],
      error: null,
    });
    queueResponse('profiles', { data: [makeProfile('other-user')], error: null });

    await expect(getAcceptedConnections()).resolves.toEqual([
      {
        profileId: 'other-user',
        connectedAt: '2026-01-03T00:00:00.000Z',
        profile: {
          id: 'other-user',
          firstName: 'Name other-user',
          age: 31,
          bio: 'A public bio',
          avatarColor: '#123456',
        },
      },
    ]);
    expect(getCalls('connections', 'eq').map((call) => call.args)).toContainEqual(['status', 'accepted']);
    expect(getCalls('connections', 'or').map((call) => call.args)).toEqual([
      ['requester_id.eq.current-user,addressee_id.eq.current-user'],
    ]);
  });

  it('maps the other participant when the current user received the request', async () => {
    queueResponse('connections', {
      data: [{
        requester_id: 'other-user',
        addressee_id: 'current-user',
        status: 'accepted',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      }],
      error: null,
    });
    queueResponse('profiles', { data: [makeProfile('other-user')], error: null });

    const connections = await getAcceptedConnections();

    expect(connections.map((connection) => connection.profileId)).toEqual(['other-user']);
    expect(getCalls('profiles', 'in').map((call) => call.args)).toEqual([
      ['id', ['other-user']],
    ]);
  });

  it('deduplicates profile IDs for lookup but preserves rows returned by the connection query', async () => {
    queueResponse('connections', {
      data: [
        {
          requester_id: 'current-user',
          addressee_id: 'other-user',
          status: 'accepted',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-03T00:00:00.000Z',
        },
        {
          requester_id: 'other-user',
          addressee_id: 'current-user',
          status: 'accepted',
          created_at: '2026-01-02T00:00:00.000Z',
          updated_at: '2026-01-04T00:00:00.000Z',
        },
      ],
      error: null,
    });
    queueResponse('profiles', { data: [makeProfile('other-user')], error: null });

    const connections = await getAcceptedConnections();

    expect(getCalls('profiles', 'in').map((call) => call.args)).toEqual([
      ['id', ['other-user']],
    ]);
    expect(connections.map((connection) => connection.profileId)).toEqual([
      'other-user',
      'other-user',
    ]);
  });

  it('handles a missing profile row and an empty connections result', async () => {
    queueResponse('connections', {
      data: [{
        requester_id: 'other-user',
        addressee_id: 'current-user',
        status: 'accepted',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      }],
      error: null,
    });
    queueResponse('profiles', { data: [], error: null });
    await expect(getAcceptedConnections()).resolves.toMatchObject([{ profile: null }]);

    mockResponses.clear();
    mockQueryCalls.length = 0;
    mockSupabase.from.mockClear();
    queueResponse('connections', { data: [], error: null });
    await expect(getAcceptedConnections()).resolves.toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it('propagates connection and profile query errors', async () => {
    const connectionError = new Error('Connections query failed');
    queueResponse('connections', { data: null, error: connectionError });
    await expect(getAcceptedConnections()).rejects.toBe(connectionError);

    mockResponses.clear();
    const profileError = new Error('Profiles query failed');
    queueResponse('connections', {
      data: [{
        requester_id: 'other-user',
        addressee_id: 'current-user',
        status: 'accepted',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
      }],
      error: null,
    });
    queueResponse('profiles', { data: null, error: profileError });
    await expect(getAcceptedConnections()).rejects.toBe(profileError);
  });
});

describe('getConnectionStatus', () => {
  it.each([
    { status: 'pending', requesterId: 'current-user', expected: 'outgoing_pending' },
    { status: 'pending', requesterId: 'other-user', expected: 'incoming_pending' },
    { status: 'accepted', requesterId: 'current-user', expected: 'accepted' },
    { status: 'declined', requesterId: 'other-user', expected: 'declined' },
  ] as const)('maps $status relationship requested by $requesterId to $expected', async ({ status, requesterId, expected }) => {
    const outgoing = requesterId === 'current-user'
      ? { requester_id: 'current-user', addressee_id: 'other-user', status }
      : null;
    const incoming = requesterId === 'other-user'
      ? { requester_id: 'other-user', addressee_id: 'current-user', status }
      : null;
    queueResponse('connections', { data: outgoing, error: null });
    queueResponse('connections', { data: incoming, error: null });

    await expect(getConnectionStatus('other-user')).resolves.toBe(expected);
    expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(getCalls('connections', 'eq').map((call) => call.args)).toEqual([
      ['requester_id', 'current-user'],
      ['addressee_id', 'other-user'],
      ['requester_id', 'other-user'],
      ['addressee_id', 'current-user'],
    ]);
    expect(getCalls('connections', 'maybeSingle')).toHaveLength(2);
  });

  it('returns none when neither direction has a relationship', async () => {
    queueResponse('connections', { data: null, error: null });
    queueResponse('connections', { data: null, error: null });

    await expect(getConnectionStatus('other-user')).resolves.toBe('none');
  });

  it('rejects checking the current user and does not query connections', async () => {
    await expect(getConnectionStatus('current-user')).rejects.toThrow(
      'A connection status can only be checked for another profile.',
    );
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('propagates query errors in either relationship direction', async () => {
    const outgoingError = new Error('Outgoing query failed');
    queueResponse('connections', { data: null, error: outgoingError });
    queueResponse('connections', { data: null, error: null });
    await expect(getConnectionStatus('other-user')).rejects.toBe(outgoingError);

    mockResponses.clear();
    const incomingError = new Error('Incoming query failed');
    queueResponse('connections', { data: null, error: null });
    queueResponse('connections', { data: null, error: incomingError });
    await expect(getConnectionStatus('other-user')).rejects.toBe(incomingError);
  });

  it('reports an error if both directional relationship rows exist', async () => {
    queueResponse('connections', {
      data: { requester_id: 'current-user', addressee_id: 'other-user', status: 'accepted' },
      error: null,
    });
    queueResponse('connections', {
      data: { requester_id: 'other-user', addressee_id: 'current-user', status: 'accepted' },
      error: null,
    });

    await expect(getConnectionStatus('other-user')).rejects.toThrow(
      'Multiple connection records exist for this profile pair.',
    );
  });
});

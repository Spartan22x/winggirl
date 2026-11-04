import {
  getConnectionCount,
  getProfile,
  getProfileInterests,
  getPublicProfiles,
  saveProfile,
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

  update(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'update', args });
    return this;
  }

  eq(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'eq', args });
    return this;
  }

  neq(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'neq', args });
    return this;
  }

  or(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'or', args });
    return this;
  }

  single() {
    mockQueryCalls.push({ table: this.table, method: 'single', args: [] });
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
    from: jest.fn(),
  },
}));

function queueResponse(table: string, response: MockResponse) {
  const responses = mockResponses.get(table) ?? [];
  responses.push(response);
  mockResponses.set(table, responses);
}

function getCalls(table: string, method: string) {
  return mockQueryCalls.filter((call) => call.table === table && call.method === method);
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
    age: overrides.age === undefined ? 32 : overrides.age,
    bio: overrides.bio === undefined ? 'A bio' : overrides.bio,
    avatar_color: overrides.avatar_color ?? '#123456',
  };
}

function queuePublicProfileResponses({
  profiles = [],
  availability = [],
  links = [],
  errors = {},
}: {
  profiles?: unknown;
  availability?: unknown;
  links?: unknown;
  errors?: Partial<Record<'profiles' | 'availability' | 'profile_interests', Error>>;
} = {}) {
  queueResponse('profiles', { data: profiles, error: errors.profiles ?? null });
  queueResponse('availability', { data: availability, error: errors.availability ?? null });
  queueResponse('profile_interests', { data: links, error: errors.profile_interests ?? null });
}

function freezeSystemDate() {
  jest.useFakeTimers().setSystemTime(new Date('2026-04-05T12:34:56.000Z'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResponses.clear();
  mockQueryCalls.length = 0;
  freezeSystemDate();
  mockSupabase.from.mockImplementation((table: string) => {
    const response = mockResponses.get(table)?.shift() ?? { data: [], error: null };
    return new MockQuery(table, response);
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getProfile', () => {
  it('selects and returns the requested profile row', async () => {
    const profile = makeProfile('profile-1');
    queueResponse('profiles', { data: profile, error: null });

    await expect(getProfile('profile-1')).resolves.toEqual(profile);
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(getCalls('profiles', 'select').map((call) => call.args)).toEqual([
      ['id, first_name, age, bio, avatar_color'],
    ]);
    expect(getCalls('profiles', 'eq').map((call) => call.args)).toEqual([
      ['id', 'profile-1'],
    ]);
    expect(getCalls('profiles', 'single')).toHaveLength(1);
  });

  it('propagates the single-row error when the profile is missing', async () => {
    const error = new Error('Profile not found');
    queueResponse('profiles', { data: null, error });

    await expect(getProfile('missing-profile')).rejects.toBe(error);
  });
});

describe('saveProfile', () => {
  it('updates only the supplied profile fields for the requested profile ID', async () => {
    queueResponse('profiles', { data: null, error: null });

    await expect(saveProfile('profile-2', {
      firstName: 'Updated',
      age: 29,
      bio: 'Updated bio',
    })).resolves.toBeUndefined();

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(getCalls('profiles', 'update').map((call) => call.args)).toEqual([
      [{ first_name: 'Updated', age: 29, bio: 'Updated bio' }],
    ]);
    expect(getCalls('profiles', 'eq').map((call) => call.args)).toEqual([
      ['id', 'profile-2'],
    ]);
  });

  it('propagates profile update errors', async () => {
    const error = new Error('Profile update failed');
    queueResponse('profiles', { data: null, error });

    await expect(saveProfile('profile-3', {
      firstName: 'Name',
      age: 30,
      bio: '',
    })).rejects.toBe(error);
  });
});

describe('getProfileInterests', () => {
  it('filters by profile ID and returns related interest names, skipping null or missing relations', async () => {
    queueResponse('profile_interests', {
      data: [
        { interests: { name: 'Hiking' } },
        { interests: null },
        {},
        { interests: { name: 'Reading' } },
      ],
      error: null,
    });

    await expect(getProfileInterests('profile-4')).resolves.toEqual(['Hiking', 'Reading']);
    expect(mockSupabase.from).toHaveBeenCalledWith('profile_interests');
    expect(getCalls('profile_interests', 'select').map((call) => call.args)).toEqual([
      ['interests(name)'],
    ]);
    expect(getCalls('profile_interests', 'eq').map((call) => call.args)).toEqual([
      ['profile_id', 'profile-4'],
    ]);
  });

  it('returns an empty list when there are no interest links', async () => {
    queueResponse('profile_interests', { data: [], error: null });

    await expect(getProfileInterests('profile-5')).resolves.toEqual([]);
  });

  it('propagates interest query errors', async () => {
    const error = new Error('Interest query failed');
    queueResponse('profile_interests', { data: null, error });

    await expect(getProfileInterests('profile-6')).rejects.toBe(error);
  });
});

describe('getConnectionCount', () => {
  it('counts accepted rows where the profile is either participant', async () => {
    queueResponse('connections', { data: null, count: 4, error: null });

    await expect(getConnectionCount('profile-7')).resolves.toBe(4);
    expect(mockSupabase.from).toHaveBeenCalledWith('connections');
    expect(getCalls('connections', 'select').map((call) => call.args)).toEqual([
      ['requester_id', { count: 'exact', head: true }],
    ]);
    expect(getCalls('connections', 'or').map((call) => call.args)).toEqual([
      ['requester_id.eq.profile-7,addressee_id.eq.profile-7'],
    ]);
    expect(getCalls('connections', 'eq').map((call) => call.args)).toEqual([
      ['status', 'accepted'],
    ]);
  });

  it('defaults a null count to zero', async () => {
    queueResponse('connections', { data: null, count: null, error: null });

    await expect(getConnectionCount('profile-8')).resolves.toBe(0);
  });

  it('propagates connection count query errors', async () => {
    const error = new Error('Connection count failed');
    queueResponse('connections', { data: null, count: null, error });

    await expect(getConnectionCount('profile-9')).rejects.toBe(error);
  });
});

describe('getPublicProfiles', () => {
  it('excludes the current user and combines profiles, interests, and current-date availability', async () => {
    queuePublicProfileResponses({
      profiles: [
        makeProfile('profile-a', { first_name: 'Ari', age: 27, bio: 'Hello' }),
        makeProfile('profile-b', { first_name: 'Bea', age: 35, bio: 'Hi' }),
      ],
      availability: [{ profile_id: 'profile-a', is_available: true }],
      links: [
        { profile_id: 'profile-a', interests: { name: 'Hiking' } },
        { profile_id: 'profile-a', interests: { name: 'Music' } },
        { profile_id: 'profile-b', interests: { name: 'Gardening' } },
      ],
    });

    await expect(getPublicProfiles('current-user')).resolves.toEqual([
      {
        id: 'profile-a',
        firstName: 'Ari',
        age: 27,
        distance: 'Nearby',
        interests: ['Hiking', 'Music'],
        available: true,
        bio: 'Hello',
        connections: 0,
        avatarColor: '#123456',
        activity: 'Hiking',
        friends: 0,
        friendsOfFriends: false,
      },
      {
        id: 'profile-b',
        firstName: 'Bea',
        age: 35,
        distance: 'Nearby',
        interests: ['Gardening'],
        available: false,
        bio: 'Hi',
        connections: 0,
        avatarColor: '#123456',
        activity: 'Gardening',
        friends: 0,
        friendsOfFriends: false,
      },
    ]);

    expect(mockSupabase.from.mock.calls.map(([table]) => table)).toEqual([
      'profiles',
      'availability',
      'profile_interests',
    ]);
    expect(getCalls('profiles', 'select').map((call) => call.args)).toEqual([
      ['id, first_name, age, bio, avatar_color'],
    ]);
    expect(getCalls('profiles', 'neq').map((call) => call.args)).toEqual([
      ['id', 'current-user'],
    ]);
    expect(getCalls('availability', 'select').map((call) => call.args)).toEqual([
      ['profile_id, is_available'],
    ]);
    expect(getCalls('availability', 'eq').map((call) => call.args)).toEqual([
      ['available_date', '2026-04-05'],
    ]);
    expect(getCalls('profile_interests', 'select').map((call) => call.args)).toEqual([
      ['profile_id, interests(name)'],
    ]);
  });

  it('uses defaults for null optional profile fields and missing related rows', async () => {
    queuePublicProfileResponses({
      profiles: [makeProfile('profile-null-fields', { age: null, bio: null })],
      availability: [],
      links: [{ profile_id: 'profile-null-fields', interests: null }],
    });

    await expect(getPublicProfiles('current-user')).resolves.toEqual([
      {
        id: 'profile-null-fields',
        firstName: 'Name profile-null-fields',
        age: 0,
        distance: 'Nearby',
        interests: [],
        available: false,
        bio: '',
        connections: 0,
        avatarColor: '#123456',
        activity: 'Something spontaneous',
        friends: 0,
        friendsOfFriends: false,
      },
    ]);
  });

  it('returns an empty list when no public profiles are returned', async () => {
    queuePublicProfileResponses();

    await expect(getPublicProfiles('current-user')).resolves.toEqual([]);
  });

  it.each(['profiles', 'availability', 'profile_interests'] as const)(
    'propagates errors from the %s query',
    async (table) => {
      const error = new Error(`${table} query failed`);
      queuePublicProfileResponses({
        errors: { [table]: error },
      });

      await expect(getPublicProfiles('current-user')).rejects.toBe(error);
    },
  );
});

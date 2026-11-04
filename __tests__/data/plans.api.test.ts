import {
  getPlanDetails,
  getPlanOverlapCandidates,
  getPlans,
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

  eq(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'eq', args });
    return this;
  }

  in(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'in', args });
    return this;
  }

  gt(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'gt', args });
    return this;
  }

  order(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'order', args });
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

function makePlan(id: string, overrides: Partial<{
  host_id: string;
  title: string;
  starts_at: string;
  activity: string;
  secondary_activity: string | null;
  status: 'upcoming' | 'invited' | 'joined' | 'past' | 'cancelled';
  visibility: 'invite_only' | 'open';
  location_name: string;
  note: string | null;
}> = {}) {
  return {
    id,
    host_id: overrides.host_id ?? 'host-1',
    title: overrides.title ?? `Plan ${id}`,
    starts_at: overrides.starts_at ?? '2026-04-10T18:30:00.000Z',
    activity: overrides.activity ?? 'Dinner',
    secondary_activity: overrides.secondary_activity === undefined ? 'Music' : overrides.secondary_activity,
    status: overrides.status ?? 'upcoming',
    visibility: overrides.visibility ?? 'invite_only',
    location_name: overrides.location_name ?? 'The Cafe',
    note: overrides.note === undefined ? 'A note' : overrides.note,
  };
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

describe('getPlans', () => {
  it('queries ordered plans and maps fields, host, membership, and participants', async () => {
    queueResponse('plans', {
      data: [
        makePlan('own-plan', {
          host_id: 'current-user',
          secondary_activity: null,
          note: null,
          visibility: 'open',
        }),
        makePlan('invited-plan', { host_id: 'host-2' }),
      ],
      error: null,
    });
    queueResponse('plan_members', {
      data: [
        { plan_id: 'own-plan', profile_id: 'current-user', status: 'joined', profiles: { first_name: 'Host' } },
        { plan_id: 'own-plan', profile_id: 'joined-user', status: 'joined', profiles: { first_name: 'Jules' } },
        { plan_id: 'own-plan', profile_id: 'declined-user', status: 'declined', profiles: { first_name: 'Rae' } },
        { plan_id: 'invited-plan', profile_id: 'current-user', status: 'invited', profiles: null },
      ],
      error: null,
    });

    const plans = await getPlans('current-user');

    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'plans');
    expect(getCalls('plans', 'select').map((call) => call.args)).toEqual([
      ['id, host_id, title, starts_at, activity, secondary_activity, status, visibility, location_name, note'],
    ]);
    expect(getCalls('plans', 'order').map((call) => call.args)).toEqual([['starts_at']]);
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'plan_members');
    expect(getCalls('plan_members', 'select').map((call) => call.args)).toEqual([
      ['plan_id, profile_id, status, profiles(first_name)'],
    ]);
    expect(getCalls('plan_members', 'in').map((call) => call.args)).toEqual([
      ['plan_id', ['own-plan', 'invited-plan']],
    ]);
    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      id: 'own-plan',
      title: 'Plan own-plan',
      startsAt: '2026-04-10T18:30:00.000Z',
      activity: 'Dinner',
      secondaryActivity: null,
      status: 'upcoming',
      visibility: 'open',
      isOpenPlan: true,
      hostId: 'current-user',
      isHost: true,
      currentUserStatus: 'joined',
      participants: [
        { profileId: 'current-user', firstName: 'Host', age: null, avatarColor: '#172535', status: 'joined' },
        { profileId: 'joined-user', firstName: 'Jules', age: null, avatarColor: '#172535', status: 'joined' },
        { profileId: 'declined-user', firstName: 'Rae', age: null, avatarColor: '#172535', status: 'declined' },
      ],
      attendees: ['Host', 'Jules'],
      location: 'The Cafe',
      host: 'You',
      note: '',
    });
    expect(plans[1]).toMatchObject({
      id: 'invited-plan',
      isHost: false,
      currentUserStatus: 'invited',
      participants: [
        { profileId: 'current-user', firstName: 'Participant', status: 'invited' },
      ],
      attendees: ['Participant'],
      host: 'Wing',
      note: 'A note',
    });
  });

  it('returns an empty list without querying plan members when no plans exist', async () => {
    queueResponse('plans', { data: [], error: null });

    await expect(getPlans('current-user')).resolves.toEqual([]);

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('plans');
  });

  it('propagates plan query errors', async () => {
    const error = new Error('Plans query failed');
    queueResponse('plans', { data: null, error });

    await expect(getPlans('current-user')).rejects.toBe(error);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it('propagates plan member query errors', async () => {
    const error = new Error('Plan members query failed');
    queueResponse('plans', { data: [makePlan('plan-1')], error: null });
    queueResponse('plan_members', { data: null, error });

    await expect(getPlans('current-user')).rejects.toBe(error);
  });
});

describe('getPlanDetails', () => {
  it('looks up the plan and returns null without related queries when it is missing', async () => {
    queueResponse('plans', { data: null, error: null });

    await expect(getPlanDetails('missing-plan', 'current-user')).resolves.toBeNull();

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(getCalls('plans', 'select').map((call) => call.args)).toEqual([
      ['id, host_id, title, starts_at, activity, secondary_activity, status, visibility, location_name, note'],
    ]);
    expect(getCalls('plans', 'eq').map((call) => call.args)).toEqual([['id', 'missing-plan']]);
    expect(getCalls('plans', 'maybeSingle')).toHaveLength(1);
  });

  it('maps plan, host, participant profiles, and declined attendee status', async () => {
    queueResponse('plans', {
      data: makePlan('plan-2', {
        host_id: 'host-2',
        secondary_activity: null,
        note: null,
        visibility: 'open',
      }),
      error: null,
    });
    queueResponse('profiles', {
      data: {
        id: 'host-2',
        first_name: 'Morgan',
        age: 34,
        bio: null,
        avatar_color: '#abcdef',
      },
      error: null,
    });
    queueResponse('plan_members', {
      data: [
        {
          profile_id: 'current-user',
          status: 'joined',
          profiles: { first_name: 'Casey', age: 29, avatar_color: '#fedcba' },
        },
        {
          profile_id: 'declined-user',
          status: 'declined',
          profiles: { first_name: 'Taylor', age: null, avatar_color: '#112233' },
        },
      ],
      error: null,
    });

    const details = await getPlanDetails('plan-2', 'current-user');

    expect(mockSupabase.from.mock.calls.map(([table]) => table)).toEqual([
      'plans',
      'profiles',
      'plan_members',
    ]);
    expect(getCalls('profiles', 'select').map((call) => call.args)).toEqual([
      ['id, first_name, age, bio, avatar_color'],
    ]);
    expect(getCalls('profiles', 'eq').map((call) => call.args)).toEqual([['id', 'host-2']]);
    expect(getCalls('plan_members', 'select').map((call) => call.args)).toEqual([
      ['profile_id, status, profiles(first_name, age, avatar_color)'],
    ]);
    expect(getCalls('plan_members', 'eq').map((call) => call.args)).toEqual([['plan_id', 'plan-2']]);
    expect(details).toMatchObject({
      id: 'plan-2',
      title: 'Plan plan-2',
      startsAt: '2026-04-10T18:30:00.000Z',
      activity: 'Dinner',
      secondaryActivity: null,
      status: 'upcoming',
      visibility: 'open',
      isOpenPlan: true,
      hostId: 'host-2',
      isHost: false,
      currentUserStatus: 'joined',
      participants: [
        { profileId: 'current-user', firstName: 'Casey', age: 29, avatarColor: '#fedcba', status: 'joined' },
        { profileId: 'declined-user', firstName: 'Taylor', age: null, avatarColor: '#112233', status: 'declined' },
      ],
      attendees: ['Casey'],
      host: 'Morgan',
      note: '',
      hostProfile: {
        id: 'host-2',
        firstName: 'Morgan',
        age: 34,
        bio: '',
        avatarColor: '#abcdef',
      },
    });
    expect(details).not.toBeNull();
  });

  it('uses fallbacks for a missing host and participant profile', async () => {
    queueResponse('plans', {
      data: makePlan('plan-3', { host_id: 'missing-host' }),
      error: null,
    });
    queueResponse('profiles', { data: null, error: null });
    queueResponse('plan_members', {
      data: [{ profile_id: 'missing-member', status: 'invited', profiles: null }],
      error: null,
    });

    await expect(getPlanDetails('plan-3', 'someone-else')).resolves.toMatchObject({
      host: 'Host',
      hostProfile: null,
      currentUserStatus: null,
      participants: [
        {
          profileId: 'missing-member',
          firstName: 'Participant',
          age: null,
          avatarColor: '#172535',
          status: 'invited',
        },
      ],
      attendees: ['Participant'],
    });
  });

  it('propagates plan query errors', async () => {
    const error = new Error('Plan lookup failed');
    queueResponse('plans', { data: null, error });

    await expect(getPlanDetails('plan-4', 'current-user')).rejects.toBe(error);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it('propagates host profile query errors', async () => {
    const error = new Error('Host query failed');
    queueResponse('plans', { data: makePlan('plan-5'), error: null });
    queueResponse('profiles', { data: null, error });
    queueResponse('plan_members', { data: [], error: null });

    await expect(getPlanDetails('plan-5', 'current-user')).rejects.toBe(error);
  });

  it('propagates plan member query errors', async () => {
    const error = new Error('Members query failed');
    queueResponse('plans', { data: makePlan('plan-6'), error: null });
    queueResponse('profiles', { data: null, error: null });
    queueResponse('plan_members', { data: null, error });

    await expect(getPlanDetails('plan-6', 'current-user')).rejects.toBe(error);
  });
});

describe('getPlanOverlapCandidates', () => {
  it('filters future eligible plans and includes only hosted or joined plans', async () => {
    queueResponse('plans', {
      data: [
        {
          id: 'hosted-plan',
          host_id: 'current-user',
          starts_at: '2026-04-06T10:00:00.000Z',
          activity: 'Brunch',
          status: 'upcoming',
          plan_members: [],
        },
        {
          id: 'joined-plan',
          host_id: 'other-host',
          starts_at: '2026-04-07T10:00:00.000Z',
          activity: 'Walk',
          status: 'joined',
          plan_members: [{ profile_id: 'current-user', status: 'joined' }],
        },
        {
          id: 'invited-plan',
          host_id: 'other-host',
          starts_at: '2026-04-08T10:00:00.000Z',
          activity: 'Dinner',
          status: 'invited',
          plan_members: [{ profile_id: 'current-user', status: 'invited' }],
        },
        {
          id: 'unrelated-plan',
          host_id: 'other-host',
          starts_at: '2026-04-09T10:00:00.000Z',
          activity: 'Music',
          status: 'upcoming',
          plan_members: [{ profile_id: 'someone-else', status: 'joined' }],
        },
      ],
      error: null,
    });

    await expect(getPlanOverlapCandidates('current-user')).resolves.toEqual([
      {
        id: 'hosted-plan',
        activity: 'Brunch',
        startsAt: '2026-04-06T10:00:00.000Z',
        isHost: true,
        currentUserStatus: null,
      },
      {
        id: 'joined-plan',
        activity: 'Walk',
        startsAt: '2026-04-07T10:00:00.000Z',
        isHost: false,
        currentUserStatus: 'joined',
      },
    ]);

    expect(getCalls('plans', 'select').map((call) => call.args)).toEqual([
      ['id, host_id, starts_at, activity, status, plan_members(profile_id, status)'],
    ]);
    expect(getCalls('plans', 'in').map((call) => call.args)).toEqual([
      ['status', ['upcoming', 'invited', 'joined']],
    ]);
    expect(getCalls('plans', 'gt').map((call) => call.args)).toEqual([
      ['starts_at', '2026-04-05T12:34:56.000Z'],
    ]);
    expect(getCalls('plans', 'order').map((call) => call.args)).toEqual([['starts_at']]);
  });

  it('returns an empty list when no candidate plans are found', async () => {
    queueResponse('plans', { data: [], error: null });

    await expect(getPlanOverlapCandidates('current-user')).resolves.toEqual([]);
  });

  it('propagates plan query errors', async () => {
    const error = new Error('Overlap query failed');
    queueResponse('plans', { data: null, error });

    await expect(getPlanOverlapCandidates('current-user')).rejects.toBe(error);
  });
});

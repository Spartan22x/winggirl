import {
  createPlan,
  getPlanDetails,
  getPlanOverlapCandidates,
  getPlans,
  joinOpenPlan,
  joinPlan,
  leavePlan,
} from '@/src/data/api';
import { randomUUID } from 'expo-crypto';
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
const mockRandomUUID = randomUUID as jest.Mock;

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

  insert(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'insert', args });
    return this;
  }

  update(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'update', args });
    return this;
  }

  delete(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'delete', args });
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

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
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

describe('createPlan', () => {
  it('creates an invite-only plan with a generated ID and normalized optional fields', async () => {
    mockRandomUUID.mockReturnValue('generated-plan-id');
    queueResponse('plans', { data: null, error: null });
    queueResponse('plan_members', { data: null, error: null });

    await expect(createPlan('host-profile', {
      startsAt: '2026-04-10T18:30:00-04:00',
      activity: ' Dinner ',
      secondaryActivity: '  Live music  ',
      invitees: [
        { profile_id: 'invitee-1', status: 'invited' },
        { profile_id: 'invitee-2', status: 'invited' },
      ],
      location: 'The Cafe',
      note: '  Bring a jacket  ',
      visibility: 'invite_only',
    })).resolves.toEqual({ id: 'generated-plan-id' });

    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'plans');
    expect(getCalls('plans', 'insert').map((call) => call.args)).toEqual([
      [{
        id: 'generated-plan-id',
        host_id: 'host-profile',
        title: ' Dinner  with the girls',
        starts_at: '2026-04-10T22:30:00.000Z',
        activity: ' Dinner ',
        secondary_activity: 'Live music',
        status: 'upcoming',
        visibility: 'invite_only',
        location_name: 'The Cafe',
        note: 'Bring a jacket',
      }],
    ]);
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'plan_members');
    expect(getCalls('plan_members', 'insert').map((call) => call.args)).toEqual([
      [[
        { plan_id: 'generated-plan-id', profile_id: 'invitee-1', status: 'invited' },
        { plan_id: 'generated-plan-id', profile_id: 'invitee-2', status: 'invited' },
      ]],
    ]);
  });

  it('uses explicit open visibility and does not insert invitees', async () => {
    mockRandomUUID.mockReturnValue('open-plan-id');
    queueResponse('plans', { data: null, error: null });

    await expect(createPlan('host-profile', {
      startsAt: '2026-04-10T18:30:00.000Z',
      activity: 'Dinner',
      invitees: [{ profile_id: 'invitee-1', status: 'invited' }],
      location: 'The Cafe',
      visibility: 'open',
    })).resolves.toEqual({ id: 'open-plan-id' });

    expect(getCalls('plans', 'insert')[0].args[0]).toMatchObject({
      visibility: 'open',
      secondary_activity: null,
      note: null,
    });
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(getCalls('plan_members', 'insert')).toHaveLength(0);
  });

  it('defaults visibility to invite-only but skips invitees when visibility is omitted', async () => {
    mockRandomUUID.mockReturnValue('default-visibility-plan-id');
    queueResponse('plans', { data: null, error: null });

    await expect(createPlan('host-profile', {
      startsAt: '2026-04-10T18:30:00.000Z',
      activity: 'Dinner',
      invitees: [{ profile_id: 'invitee-1', status: 'invited' }],
      location: 'The Cafe',
    })).resolves.toEqual({ id: 'default-visibility-plan-id' });

    expect(getCalls('plans', 'insert')[0].args[0]).toMatchObject({
      visibility: 'invite_only',
    });
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(getCalls('plan_members', 'insert')).toHaveLength(0);
  });

  it('supports explicit invite-only visibility and skips member insertion for an empty invitee list', async () => {
    mockRandomUUID.mockReturnValue('empty-invites-plan-id');
    queueResponse('plans', { data: null, error: null });

    await expect(createPlan('host-profile', {
      startsAt: '2026-04-10T18:30:00.000Z',
      activity: 'Dinner',
      invitees: [],
      location: 'The Cafe',
      visibility: 'invite_only',
      note: '   ',
      secondaryActivity: '  ',
    })).resolves.toEqual({ id: 'empty-invites-plan-id' });

    expect(getCalls('plans', 'insert')[0].args[0]).toMatchObject({
      visibility: 'invite_only',
      secondary_activity: null,
      note: null,
    });
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(getCalls('plan_members', 'insert')).toHaveLength(0);
  });

  it('propagates plan insert errors without attempting invitee insertion', async () => {
    const error = new Error('Plan insert failed');
    mockRandomUUID.mockReturnValue('failed-plan-id');
    queueResponse('plans', { data: null, error });

    await expect(createPlan('host-profile', {
      startsAt: '2026-04-10T18:30:00.000Z',
      activity: 'Dinner',
      invitees: [{ profile_id: 'invitee-1', status: 'invited' }],
      location: 'The Cafe',
    })).rejects.toBe(error);

    expect(getCalls('plans', 'insert')).toHaveLength(1);
    expect(getCalls('plan_members', 'insert')).toHaveLength(0);
  });

  it('propagates invitee insert errors after successfully inserting the plan', async () => {
    const error = new Error('Invitee insert failed');
    mockRandomUUID.mockReturnValue('partial-plan-id');
    queueResponse('plans', { data: null, error: null });
    queueResponse('plan_members', { data: null, error });

    await expect(createPlan('host-profile', {
      startsAt: '2026-04-10T18:30:00.000Z',
      activity: 'Dinner',
      invitees: [{ profile_id: 'invitee-1', status: 'invited' }],
      location: 'The Cafe',
      visibility: 'invite_only',
    })).rejects.toBe(error);

    expect(getCalls('plans', 'insert')).toHaveLength(1);
    expect(getCalls('plan_members', 'insert')).toHaveLength(1);
  });
});

describe('joinPlan', () => {
  it('updates only the matching invited membership to joined', async () => {
    queueResponse('plan_members', { data: { plan_id: 'plan-1' }, error: null });

    await expect(joinPlan('plan-1', 'profile-1')).resolves.toBeUndefined();

    expect(mockSupabase.from).toHaveBeenCalledWith('plan_members');
    expect(getCalls('plan_members', 'update').map((call) => call.args)).toEqual([
      [{ status: 'joined' }],
    ]);
    expect(getCalls('plan_members', 'eq').map((call) => call.args)).toEqual([
      ['plan_id', 'plan-1'],
      ['profile_id', 'profile-1'],
      ['status', 'invited'],
    ]);
    expect(getCalls('plan_members', 'select').map((call) => call.args)).toEqual([
      ['plan_id'],
    ]);
    expect(getCalls('plan_members', 'maybeSingle')).toHaveLength(1);
  });

  it('throws when no matching invitation is available', async () => {
    queueResponse('plan_members', { data: null, error: null });

    await expect(joinPlan('plan-2', 'profile-2')).rejects.toThrow(
      'This invitation is no longer available.',
    );
  });

  it('propagates membership update errors', async () => {
    const error = new Error('Membership update failed');
    queueResponse('plan_members', { data: null, error });

    await expect(joinPlan('plan-3', 'profile-3')).rejects.toBe(error);
  });
});

describe('joinOpenPlan', () => {
  it('inserts a joined membership with the requested plan and profile IDs', async () => {
    queueResponse('plan_members', { data: null, error: null });

    await expect(joinOpenPlan('open-plan', 'profile-4')).resolves.toBeUndefined();

    expect(mockSupabase.from).toHaveBeenCalledWith('plan_members');
    expect(getCalls('plan_members', 'insert').map((call) => call.args)).toEqual([
      [{ plan_id: 'open-plan', profile_id: 'profile-4', status: 'joined' }],
    ]);
  });

  it('propagates membership insert errors', async () => {
    const error = new Error('Open plan membership insert failed');
    queueResponse('plan_members', { data: null, error });

    await expect(joinOpenPlan('open-plan', 'profile-5')).rejects.toBe(error);
  });
});

describe('leavePlan', () => {
  it('deletes the matching joined membership when the delete count is positive', async () => {
    queueResponse('plan_members', { data: null, count: 1, error: null });

    await expect(leavePlan('plan-6', 'profile-6')).resolves.toBeUndefined();

    expect(mockSupabase.from).toHaveBeenCalledWith('plan_members');
    expect(getCalls('plan_members', 'delete').map((call) => call.args)).toEqual([
      [{ count: 'exact' }],
    ]);
    expect(getCalls('plan_members', 'eq').map((call) => call.args)).toEqual([
      ['plan_id', 'plan-6'],
      ['profile_id', 'profile-6'],
      ['status', 'joined'],
    ]);
  });

  it.each([0, null])('throws when the delete count is %s', async (count) => {
    queueResponse('plan_members', { data: null, count, error: null });

    await expect(leavePlan('plan-7', 'profile-7')).rejects.toThrow(
      'You are not participating in this plan.',
    );
  });

  it('propagates membership delete errors', async () => {
    const error = new Error('Membership delete failed');
    queueResponse('plan_members', { data: null, count: null, error });

    await expect(leavePlan('plan-8', 'profile-8')).rejects.toBe(error);
  });
});

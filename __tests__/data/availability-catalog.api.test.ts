import {
  getActivities,
  getAvailability,
  getLocations,
  setAvailability,
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

  eq(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'eq', args });
    return this;
  }

  order(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'order', args });
    return this;
  }

  upsert(...args: unknown[]) {
    mockQueryCalls.push({ table: this.table, method: 'upsert', args });
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

describe('getAvailability', () => {
  it('filters by profile ID and the current UTC date, returning true when available', async () => {
    queueResponse('availability', {
      data: { is_available: true },
      error: null,
    });

    await expect(getAvailability('profile-1')).resolves.toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('availability');
    expect(getCalls('availability', 'select').map((call) => call.args)).toEqual([
      ['is_available'],
    ]);
    expect(getCalls('availability', 'eq').map((call) => call.args)).toEqual([
      ['profile_id', 'profile-1'],
      ['available_date', '2026-04-05'],
    ]);
    expect(getCalls('availability', 'maybeSingle')).toHaveLength(1);
  });

  it('returns false when the selected availability row is unavailable', async () => {
    queueResponse('availability', {
      data: { is_available: false },
      error: null,
    });

    await expect(getAvailability('profile-2')).resolves.toBe(false);
  });

  it('defaults to false when no availability row exists', async () => {
    queueResponse('availability', { data: null, error: null });

    await expect(getAvailability('profile-3')).resolves.toBe(false);
  });

  it('propagates availability query errors', async () => {
    const error = new Error('Availability query failed');
    queueResponse('availability', { data: null, error });

    await expect(getAvailability('profile-4')).rejects.toBe(error);
  });
});

describe('setAvailability', () => {
  it.each([true, false])('upserts availability=$isAvailable for the profile and current UTC date', async (isAvailable) => {
    queueResponse('availability', { data: null, error: null });

    await expect(setAvailability('profile-5', isAvailable)).resolves.toBeUndefined();
    expect(mockSupabase.from).toHaveBeenCalledWith('availability');
    expect(getCalls('availability', 'upsert').map((call) => call.args)).toEqual([
      [{
        profile_id: 'profile-5',
        available_date: '2026-04-05',
        is_available: isAvailable,
      }],
    ]);
  });

  it('propagates availability upsert errors', async () => {
    const error = new Error('Availability upsert failed');
    queueResponse('availability', { data: null, error });

    await expect(setAvailability('profile-6', true)).rejects.toBe(error);
  });
});

describe('getActivities', () => {
  it('selects activity names in database order and normalizes the existing legacy names', async () => {
    queueResponse('interests', {
      data: [
        { name: 'Fitness' },
        { name: 'Live music' },
        { name: 'Something spontaneous' },
        { name: 'Yoga' },
      ],
      error: null,
    });

    await expect(getActivities()).resolves.toEqual([
      'Workout',
      'Music',
      'Something Fun',
      'Yoga',
    ]);
    expect(mockSupabase.from).toHaveBeenCalledWith('interests');
    expect(getCalls('interests', 'select').map((call) => call.args)).toEqual([
      ['name'],
    ]);
    expect(getCalls('interests', 'eq').map((call) => call.args)).toEqual([
      ['kind', 'activity'],
    ]);
    expect(getCalls('interests', 'order').map((call) => call.args)).toEqual([
      ['name'],
    ]);
  });

  it('returns an empty list when no activities are returned', async () => {
    queueResponse('interests', { data: [], error: null });

    await expect(getActivities()).resolves.toEqual([]);
  });

  it('propagates activity query errors', async () => {
    const error = new Error('Activity query failed');
    queueResponse('interests', { data: null, error });

    await expect(getActivities()).rejects.toBe(error);
  });
});

describe('getLocations', () => {
  it('selects location fields ordered by name and returns the rows unchanged', async () => {
    const locations = [
      { id: 'location-1', name: 'Cafe A', area: 'North', vibe: 'Cozy', note: 'Coffee' },
      { id: 'location-2', name: 'Park B', area: 'South', vibe: 'Relaxed', note: 'Walks' },
    ];
    queueResponse('locations', { data: locations, error: null });

    await expect(getLocations()).resolves.toEqual(locations);
    expect(mockSupabase.from).toHaveBeenCalledWith('locations');
    expect(getCalls('locations', 'select').map((call) => call.args)).toEqual([
      ['id, name, area, vibe, note'],
    ]);
    expect(getCalls('locations', 'order').map((call) => call.args)).toEqual([
      ['name'],
    ]);
  });

  it('returns an empty list when no locations are returned', async () => {
    queueResponse('locations', { data: [], error: null });

    await expect(getLocations()).resolves.toEqual([]);
  });

  it('propagates location query errors', async () => {
    const error = new Error('Location query failed');
    queueResponse('locations', { data: null, error });

    await expect(getLocations()).rejects.toBe(error);
  });
});

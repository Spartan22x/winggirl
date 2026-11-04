import { getPlanDateTimeOptions } from '@/src/lib/planDateTime';

function getLocalSlot(date: Date, dayOffset: number, hour: number, minute: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
    hour,
    minute,
  ).toISOString();
}

function getLocalDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

describe('getPlanDateTimeOptions', () => {
  it('returns valid future slots for today and the following six days', () => {
    const now = new Date(2026, 10, 3, 17, 0);
    const options = getPlanDateTimeOptions(now);

    expect(options).toHaveLength(21);
    expect(options.slice(0, 3).map((option) => option.startsAt)).toEqual([
      getLocalSlot(now, 0, 18, 30),
      getLocalSlot(now, 0, 19, 15),
      getLocalSlot(now, 0, 20, 30),
    ]);
    expect(options.every((option) => new Date(option.startsAt) > now)).toBe(true);
    expect(options.every((option) => option.label.length > 0)).toBe(true);
  });

  it('omits earlier slots when some evening slots have already passed', () => {
    const now = new Date(2026, 10, 3, 19, 45);
    const options = getPlanDateTimeOptions(now);

    expect(options).toHaveLength(19);
    expect(options[0].startsAt).toBe(getLocalSlot(now, 0, 20, 30));
    expect(options.every((option) => new Date(option.startsAt) > now)).toBe(true);
  });

  it('treats a slot at the current time as not future', () => {
    const now = new Date(2026, 10, 3, 19, 15);
    const options = getPlanDateTimeOptions(now);

    expect(options[0].startsAt).toBe(getLocalSlot(now, 0, 20, 30));
    expect(options.some((option) => option.startsAt === getLocalSlot(now, 0, 19, 15))).toBe(false);
  });

  it.each([
    { hour: 18, minute: 30, laterSlots: 2 },
    { hour: 19, minute: 15, laterSlots: 1 },
    { hour: 20, minute: 30, laterSlots: 0 },
  ])('excludes the $hour:$minute slot at and after its exact boundary', ({ hour, minute, laterSlots }) => {
    const slot = new Date(2026, 10, 3, hour, minute);
    const before = new Date(slot.getTime() - 1);
    const exact = slot;
    const after = new Date(slot.getTime() + 1);

    const beforeOptions = getPlanDateTimeOptions(before);
    const exactOptions = getPlanDateTimeOptions(exact);
    const afterOptions = getPlanDateTimeOptions(after);
    const sameDayOptions = (options: ReturnType<typeof getPlanDateTimeOptions>, date: Date) =>
      options.filter((option) => getLocalDateKey(option.startsAt) === getLocalDateKey(date.toISOString()));

    expect(sameDayOptions(beforeOptions, before).map((option) => option.startsAt)).toContain(slot.toISOString());
    expect(sameDayOptions(exactOptions, exact)).toHaveLength(laterSlots);
    expect(sameDayOptions(afterOptions, after)).toHaveLength(laterSlots);
    expect(sameDayOptions(exactOptions, exact).every((option) => new Date(option.startsAt) > exact)).toBe(true);
    expect(sameDayOptions(afterOptions, after).every((option) => new Date(option.startsAt) > after)).toBe(true);
  });

  it('starts on the next day and extends through seven days when no slots remain today', () => {
    const now = new Date(2026, 10, 3, 20, 30);
    const options = getPlanDateTimeOptions(now);

    expect(options).toHaveLength(21);
    expect(options[0].startsAt).toBe(getLocalSlot(now, 1, 18, 30));
    expect(options.at(-1)?.startsAt).toBe(getLocalSlot(now, 7, 20, 30));
  });

  it('includes the full six-days-later window when called shortly after midnight', () => {
    const now = new Date(2026, 10, 3, 0, 5);
    const options = getPlanDateTimeOptions(now);

    expect(options).toHaveLength(21);
    expect(options.slice(0, 3).map((option) => option.startsAt)).toEqual([
      getLocalSlot(now, 0, 18, 30),
      getLocalSlot(now, 0, 19, 15),
      getLocalSlot(now, 0, 20, 30),
    ]);
    expect(options[0].startsAt).toBe(getLocalSlot(now, 0, 18, 30));
    expect(options.at(-1)?.startsAt).toBe(getLocalSlot(now, 6, 20, 30));
    expect(options.every((option) => new Date(option.startsAt) >= new Date(2026, 10, 3))).toBe(true);
  });

  it('does not mutate the supplied Date instance', () => {
    const now = new Date(2026, 10, 3, 17, 0, 42, 123);
    const originalTimestamp = now.getTime();
    const originalString = now.toString();

    getPlanDateTimeOptions(now);

    expect(now.getTime()).toBe(originalTimestamp);
    expect(now.toString()).toBe(originalString);
  });

  it('continues slot generation across a month boundary', () => {
    const now = new Date(2026, 0, 30, 17, 0);
    const options = getPlanDateTimeOptions(now);

    expect(options).toHaveLength(21);
    expect(options.slice(0, 6).map((option) => option.startsAt)).toEqual([
      getLocalSlot(now, 0, 18, 30),
      getLocalSlot(now, 0, 19, 15),
      getLocalSlot(now, 0, 20, 30),
      getLocalSlot(now, 1, 18, 30),
      getLocalSlot(now, 1, 19, 15),
      getLocalSlot(now, 1, 20, 30),
    ]);
    expect(options.slice(6, 9).map((option) => option.startsAt)).toEqual([
      getLocalSlot(now, 2, 18, 30),
      getLocalSlot(now, 2, 19, 15),
      getLocalSlot(now, 2, 20, 30),
    ]);
    expect(options.slice(6).every((option) => new Date(option.startsAt).getMonth() === 1)).toBe(true);
  });

  it('generates all slots across leap day in a leap year', () => {
    const now = new Date(2028, 1, 27, 17, 0);
    const options = getPlanDateTimeOptions(now);
    const leapDayOptions = options.filter((option) => getLocalDateKey(option.startsAt) === '2028-1-29');

    expect(leapDayOptions.map((option) => option.startsAt)).toEqual([
      getLocalSlot(now, 2, 18, 30),
      getLocalSlot(now, 2, 19, 15),
      getLocalSlot(now, 2, 20, 30),
    ]);
    expect(options).toHaveLength(21);
  });

  it('transitions across month and year boundaries using local calendar dates', () => {
    const now = new Date(2026, 11, 31, 21, 0);
    const options = getPlanDateTimeOptions(now);

    expect(options[0].startsAt).toBe(getLocalSlot(now, 1, 18, 30));
    expect(new Date(options[0].startsAt).getFullYear()).toBe(2027);
    expect(new Date(options[0].startsAt).getMonth()).toBe(0);
    expect(options.at(-1)?.startsAt).toBe(getLocalSlot(now, 7, 20, 30));
  });

  it('returns unique timestamps in chronological order with three slots on every fully eligible day', () => {
    const now = new Date(2026, 10, 3, 17, 0);
    const options = getPlanDateTimeOptions(now);
    const timestamps = options.map((option) => new Date(option.startsAt).getTime());
    const countsByDate = new Map<string, number>();

    options.forEach((option) => {
      const dateKey = getLocalDateKey(option.startsAt);
      countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
    });

    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    expect(new Set(options.map((option) => option.startsAt)).size).toBe(options.length);
    expect([...countsByDate.values()]).toEqual(Array(7).fill(3));
  });

  it('returns only remaining slots on a partially elapsed day', () => {
    const now = new Date(2026, 10, 3, 19, 45);
    const options = getPlanDateTimeOptions(now);
    const countsByDate = new Map<string, number>();

    options.forEach((option) => {
      const dateKey = getLocalDateKey(option.startsAt);
      countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
    });

    expect([...countsByDate.values()]).toEqual([1, 3, 3, 3, 3, 3, 3]);
    expect(options[0].startsAt).toBe(getLocalSlot(now, 0, 20, 30));
  });

  it('formats each label from its timestamp using the runtime locale and timezone', () => {
    const now = new Date(2026, 10, 3, 17, 0);
    const options = getPlanDateTimeOptions(now);
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    options.forEach((option) => {
      const startsAt = new Date(option.startsAt);
      expect(option.label).toBe(`${dateFormatter.format(startsAt)} • ${timeFormatter.format(startsAt)}`);
    });
  });

  it('uses the current time when now is omitted', () => {
    const systemTime = new Date(2026, 10, 3, 17, 0);
    jest.useFakeTimers().setSystemTime(systemTime);

    try {
      const options = getPlanDateTimeOptions();
      expect(options[0].startsAt).toBe(getLocalSlot(systemTime, 0, 18, 30));
    } finally {
      jest.useRealTimers();
    }
  });

  it('throws for an invalid Date because it cannot serialize a slot', () => {
    expect(() => getPlanDateTimeOptions(new Date(Number.NaN))).toThrow(RangeError);
  });
});

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

  it('starts on the next day and extends through seven days when no slots remain today', () => {
    const now = new Date(2026, 10, 3, 20, 30);
    const options = getPlanDateTimeOptions(now);

    expect(options).toHaveLength(21);
    expect(options[0].startsAt).toBe(getLocalSlot(now, 1, 18, 30));
    expect(options.at(-1)?.startsAt).toBe(getLocalSlot(now, 7, 20, 30));
  });

  it('transitions across month and year boundaries using local calendar dates', () => {
    const now = new Date(2026, 11, 31, 21, 0);
    const options = getPlanDateTimeOptions(now);

    expect(options[0].startsAt).toBe(getLocalSlot(now, 1, 18, 30));
    expect(new Date(options[0].startsAt).getFullYear()).toBe(2027);
    expect(new Date(options[0].startsAt).getMonth()).toBe(0);
    expect(options.at(-1)?.startsAt).toBe(getLocalSlot(now, 7, 20, 30));
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

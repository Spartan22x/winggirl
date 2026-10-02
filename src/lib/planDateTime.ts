export type PlanDateTimeOption = {
  startsAt: string;
  label: string;
};

const timeSlots = [
  { hour: 18, minute: 30 },
  { hour: 19, minute: 15 },
  { hour: 20, minute: 30 },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

export function getPlanDateTimeOptions(now = new Date()): PlanDateTimeOption[] {
  const options: PlanDateTimeOption[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hasOptionsToday = timeSlots.some((slot) => {
    const startsAt = new Date(today);
    startsAt.setHours(slot.hour, slot.minute, 0, 0);
    return startsAt.getTime() > now.getTime();
  });
  const lastDayOffset = hasOptionsToday ? 6 : 7;

  for (let dayOffset = 0; dayOffset <= lastDayOffset; dayOffset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);

    for (const slot of timeSlots) {
      const startsAt = new Date(date);
      startsAt.setHours(slot.hour, slot.minute, 0, 0);
      if (startsAt.getTime() <= now.getTime()) continue;

      options.push({
        startsAt: startsAt.toISOString(),
        label: `${dateFormatter.format(startsAt)} • ${timeFormatter.format(startsAt)}`,
      });
    }
  }

  return options;
}
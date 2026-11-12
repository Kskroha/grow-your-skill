function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDay(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dayKey(date);
}

export function computeStreak(dates: Date[], now = new Date()): number {
  if (!dates.length) {
    return 0;
  }
  const days = new Set(dates.map(dayKey));
  let cursor = dayKey(now);
  if (!days.has(cursor)) {
    cursor = shiftDay(cursor, -1);
  }
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

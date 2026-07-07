const MS_PER_DAY = 86_400_000;

/** Days since the Unix epoch for a local-calendar ISO date (YYYY-MM-DD). */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** Day number of the Monday starting the week that contains `dayNum`. */
function weekStart(dayNum: number): number {
  // Epoch day 0 (1970-01-01) was a Thursday, so +3 makes Monday ≡ 0.
  return dayNum - ((dayNum + 3) % 7);
}

/** Months since year 0 — lets calendar months compare across year boundaries. */
function monthNumber(iso: string): number {
  const [y, m] = iso.split('-').map(Number);
  return y * 12 + (m - 1);
}

/**
 * Human-friendly label for a due date relative to `today` (both YYYY-MM-DD).
 *
 * Day granularity wins over calendar buckets: "today", "tomorrow"/"yesterday",
 * then "in N days"/"N days ago" up to 6 days out. Beyond that, dates in the
 * adjacent calendar week (Mon–Sun) become "next week"/"last week", remaining
 * same-month dates stay day-counted, and dates in the adjacent calendar month
 * become "next month"/"last month". Anything further returns the raw ISO date.
 */
export function formatRelativeDueDate(dueDate: string, today: string): string {
  const dueDay = dayNumber(dueDate);
  const todayDay = dayNumber(today);
  const diff = dueDay - todayDay;

  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff >= 2 && diff <= 6) return `in ${diff} days`;
  if (diff <= -2 && diff >= -6) return `${-diff} days ago`;

  const weekDelta = (weekStart(dueDay) - weekStart(todayDay)) / 7;
  if (weekDelta === 1) return 'next week';
  if (weekDelta === -1) return 'last week';

  const monthDelta = monthNumber(dueDate) - monthNumber(today);
  if (monthDelta === 0) return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
  if (monthDelta === 1) return 'next month';
  if (monthDelta === -1) return 'last month';

  return dueDate;
}

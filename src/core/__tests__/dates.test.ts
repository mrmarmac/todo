import { describe, it, expect } from 'vitest';
import { formatRelativeDueDate, dueDateUrgency, addDaysISO } from '../dates';

// 2026-07-07 is a Tuesday; its Mon–Sun week runs 2026-07-06 … 2026-07-12.
const TODAY = '2026-07-07';

describe('formatRelativeDueDate', () => {
  it('labels today, tomorrow and yesterday', () => {
    expect(formatRelativeDueDate('2026-07-07', TODAY)).toBe('today');
    expect(formatRelativeDueDate('2026-07-08', TODAY)).toBe('tomorrow');
    expect(formatRelativeDueDate('2026-07-06', TODAY)).toBe('yesterday');
  });

  it('counts days for dates 2–6 days away', () => {
    expect(formatRelativeDueDate('2026-07-09', TODAY)).toBe('in 2 days');
    expect(formatRelativeDueDate('2026-07-13', TODAY)).toBe('in 6 days');
    expect(formatRelativeDueDate('2026-07-05', TODAY)).toBe('2 days ago');
    expect(formatRelativeDueDate('2026-07-01', TODAY)).toBe('6 days ago');
  });

  it('prefers day granularity over week buckets', () => {
    // 2026-07-13 is in the next calendar week but only 6 days out (covered
    // above); the tightest boundary is Sunday → Monday.
    expect(formatRelativeDueDate('2026-07-13', '2026-07-12')).toBe('tomorrow');
  });

  it('labels adjacent calendar weeks', () => {
    expect(formatRelativeDueDate('2026-07-14', TODAY)).toBe('next week'); // Tue, 7 days out
    expect(formatRelativeDueDate('2026-07-19', TODAY)).toBe('next week'); // Sun, 12 days out
    expect(formatRelativeDueDate('2026-06-30', TODAY)).toBe('last week'); // Tue, 7 days back
    expect(formatRelativeDueDate('2026-06-29', TODAY)).toBe('last week'); // Mon, 8 days back
  });

  it('lets next/last week win when the week crosses a month boundary', () => {
    // 2026-07-27 and 2026-08-03 are both Mondays.
    expect(formatRelativeDueDate('2026-08-03', '2026-07-27')).toBe('next week');
    expect(formatRelativeDueDate('2026-07-27', '2026-08-03')).toBe('last week');
  });

  it('counts days for same-month dates beyond the adjacent week', () => {
    expect(formatRelativeDueDate('2026-07-25', TODAY)).toBe('in 18 days');
    expect(formatRelativeDueDate('2026-07-05', '2026-07-28')).toBe('23 days ago');
  });

  it('labels adjacent calendar months', () => {
    expect(formatRelativeDueDate('2026-08-25', TODAY)).toBe('next month');
    expect(formatRelativeDueDate('2026-06-15', TODAY)).toBe('last month');
  });

  it('labels adjacent months across a year boundary', () => {
    expect(formatRelativeDueDate('2027-01-20', '2026-12-15')).toBe('next month');
    expect(formatRelativeDueDate('2026-12-05', '2027-01-10')).toBe('last month');
  });

  it('falls back to the raw ISO date beyond adjacent months', () => {
    expect(formatRelativeDueDate('2026-09-01', TODAY)).toBe('2026-09-01');
    expect(formatRelativeDueDate('2026-05-20', TODAY)).toBe('2026-05-20');
    expect(formatRelativeDueDate('2027-07-07', TODAY)).toBe('2027-07-07');
  });
});

describe('dueDateUrgency', () => {
  it('flags past dates as overdue', () => {
    expect(dueDateUrgency('2026-07-06', TODAY)).toBe('overdue');
    expect(dueDateUrgency('2026-01-01', TODAY)).toBe('overdue');
  });

  it('flags the current day as today', () => {
    expect(dueDateUrgency('2026-07-07', TODAY)).toBe('today');
  });

  it('flags the next two days as soon', () => {
    expect(dueDateUrgency('2026-07-08', TODAY)).toBe('soon');
    expect(dueDateUrgency('2026-07-09', TODAY)).toBe('soon');
  });

  it('flags three-plus days out as upcoming', () => {
    expect(dueDateUrgency('2026-07-10', TODAY)).toBe('upcoming');
    expect(dueDateUrgency('2026-12-31', TODAY)).toBe('upcoming');
  });
});

describe('addDaysISO', () => {
  it('advances by whole days', () => {
    expect(addDaysISO('2026-07-07', 1)).toBe('2026-07-08');
    expect(addDaysISO('2026-07-07', 7)).toBe('2026-07-14');
    expect(addDaysISO('2026-07-07', 0)).toBe('2026-07-07');
  });

  it('rolls across month and year boundaries', () => {
    expect(addDaysISO('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });
});

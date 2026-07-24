import { addDaysISO, isValidISODate, isoWeekday } from './dates';

/**
 * Weekday tokens, mapped to the ISO weekday index used by `isoWeekday`
 * (0 = Monday … 6 = Sunday). Common short forms are accepted so the token
 * can be typed without thinking about which abbreviation the app wants.
 */
const WEEKDAYS: Record<string, number> = {
  mon: 0, monday: 0,
  tue: 1, tues: 1, tuesday: 1,
  wed: 2, weds: 2, wednesday: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6,
};

/** `+3`, `+3d`, `+2w` — a relative offset in days or weeks. */
const OFFSET_RE = /^\+(\d{1,4})([dw])?$/;

export interface ParsedTaskInput {
  /** The title with a recognised trailing date token removed. */
  title: string;
  /** The resolved due date (YYYY-MM-DD), or null when no token was found. */
  dueDate: string | null;
  /** The raw token that produced `dueDate`, so the UI can echo what it matched. */
  token: string | null;
}

/**
 * Resolve a single date token against `today` (YYYY-MM-DD), or null when the
 * token is not a date.
 *
 * A weekday token resolves to the nearest occurrence at or after today, so
 * typing "mon" on a Monday means today — matching the convention used by most
 * task apps, and always visible in the add form's live preview before submit.
 */
function resolveToken(token: string, today: string): string | null {
  const t = token.toLowerCase();

  if (t === 'today' || t === 'tod') return today;
  if (t === 'tomorrow' || t === 'tom' || t === 'tmr') return addDaysISO(today, 1);

  const weekday = WEEKDAYS[t];
  if (weekday !== undefined) {
    return addDaysISO(today, (weekday - isoWeekday(today) + 7) % 7);
  }

  const offset = OFFSET_RE.exec(t);
  if (offset) {
    const n = Number(offset[1]);
    return addDaysISO(today, offset[2] === 'w' ? n * 7 : n);
  }

  if (isValidISODate(t)) return t;

  return null;
}

/**
 * Split a typed task title into a title and a due date, so a date can be set
 * without leaving the keyboard: "Renew passport fri", "Draft report +3d",
 * "Book dentist 2026-08-01".
 *
 * Only the final whitespace-separated token is considered, and only when what
 * remains is a non-empty title — so "Plan the weekend" keeps its last word and
 * a bare "fri" stays a task called "fri". When nothing matches, the title is
 * returned untouched with a null due date.
 */
export function parseTaskInput(raw: string, today: string): ParsedTaskInput {
  const trimmed = raw.trim();
  const match = /\s+(\S+)$/.exec(trimmed);
  if (!match) return { title: trimmed, dueDate: null, token: null };

  const token = match[1];
  const dueDate = resolveToken(token, today);
  if (dueDate === null) return { title: trimmed, dueDate: null, token: null };

  const title = trimmed.slice(0, match.index).trim();
  if (title === '') return { title: trimmed, dueDate: null, token: null };

  return { title, dueDate, token };
}

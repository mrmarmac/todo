import { describe, expect, it } from 'vitest';
import { parseTaskInput } from '../taskInput';

// 2026-07-24 is a Friday — every weekday expectation below is anchored to it.
const TODAY = '2026-07-24';

describe('parseTaskInput', () => {
  it('returns the title untouched when there is no trailing date token', () => {
    expect(parseTaskInput('Renew passport', TODAY)).toEqual({
      title: 'Renew passport',
      dueDate: null,
      token: null,
    });
  });

  it('parses "today" and its short form', () => {
    expect(parseTaskInput('Book dentist today', TODAY)).toEqual({
      title: 'Book dentist',
      dueDate: TODAY,
      token: 'today',
    });
    expect(parseTaskInput('Book dentist tod', TODAY).dueDate).toBe(TODAY);
  });

  it('parses "tomorrow" and its short forms', () => {
    expect(parseTaskInput('Call the bank tomorrow', TODAY)).toEqual({
      title: 'Call the bank',
      dueDate: '2026-07-25',
      token: 'tomorrow',
    });
    expect(parseTaskInput('Call the bank tom', TODAY).dueDate).toBe('2026-07-25');
    expect(parseTaskInput('Call the bank tmr', TODAY).dueDate).toBe('2026-07-25');
  });

  it('resolves a weekday to its next occurrence', () => {
    // Friday → the coming Monday is 3 days out.
    expect(parseTaskInput('Draft report mon', TODAY).dueDate).toBe('2026-07-27');
    expect(parseTaskInput('Draft report monday', TODAY).dueDate).toBe('2026-07-27');
    // Sunday is 2 days out.
    expect(parseTaskInput('Rest sun', TODAY).dueDate).toBe('2026-07-26');
  });

  it('treats today’s own weekday as today', () => {
    expect(parseTaskInput('Ship it fri', TODAY).dueDate).toBe(TODAY);
    expect(parseTaskInput('Ship it friday', TODAY).dueDate).toBe(TODAY);
  });

  it('accepts every weekday abbreviation', () => {
    expect(parseTaskInput('x tue', TODAY).dueDate).toBe('2026-07-28');
    expect(parseTaskInput('x tues', TODAY).dueDate).toBe('2026-07-28');
    expect(parseTaskInput('x weds', TODAY).dueDate).toBe('2026-07-29');
    expect(parseTaskInput('x thurs', TODAY).dueDate).toBe('2026-07-30');
    expect(parseTaskInput('x sat', TODAY).dueDate).toBe('2026-07-25');
  });

  it('parses day and week offsets', () => {
    expect(parseTaskInput('Draft report +3', TODAY).dueDate).toBe('2026-07-27');
    expect(parseTaskInput('Draft report +3d', TODAY).dueDate).toBe('2026-07-27');
    expect(parseTaskInput('Draft report +2w', TODAY).dueDate).toBe('2026-08-07');
    expect(parseTaskInput('Draft report +0', TODAY).dueDate).toBe(TODAY);
  });

  it('parses an explicit ISO date', () => {
    expect(parseTaskInput('File taxes 2026-08-01', TODAY)).toEqual({
      title: 'File taxes',
      dueDate: '2026-08-01',
      token: '2026-08-01',
    });
  });

  it('rejects an impossible ISO date and keeps it in the title', () => {
    expect(parseTaskInput('Weird 2026-02-31', TODAY)).toEqual({
      title: 'Weird 2026-02-31',
      dueDate: null,
      token: null,
    });
  });

  it('is case-insensitive', () => {
    expect(parseTaskInput('Book dentist TOMORROW', TODAY).dueDate).toBe('2026-07-25');
    expect(parseTaskInput('Book dentist Fri', TODAY).dueDate).toBe(TODAY);
  });

  it('only ever considers the final token', () => {
    // "monday" here is not last, so it stays part of the title.
    expect(parseTaskInput('Review monday notes', TODAY)).toEqual({
      title: 'Review monday notes',
      dueDate: null,
      token: null,
    });
  });

  it('keeps a lone date word as the title rather than emptying it', () => {
    expect(parseTaskInput('tomorrow', TODAY)).toEqual({
      title: 'tomorrow',
      dueDate: null,
      token: null,
    });
    expect(parseTaskInput('  fri  ', TODAY).title).toBe('fri');
  });

  it('leaves a bare URL title alone', () => {
    expect(parseTaskInput('https://example.com/read-me', TODAY)).toEqual({
      title: 'https://example.com/read-me',
      dueDate: null,
      token: null,
    });
  });

  it('trims surrounding whitespace from the title', () => {
    expect(parseTaskInput('   Book dentist   tomorrow  ', TODAY)).toEqual({
      title: 'Book dentist',
      dueDate: '2026-07-25',
      token: 'tomorrow',
    });
  });

  it('crosses a month boundary correctly', () => {
    expect(parseTaskInput('Pay rent +8d', TODAY).dueDate).toBe('2026-08-01');
  });
});

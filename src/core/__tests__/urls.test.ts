import { describe, it, expect } from 'vitest';
import { parseUrl } from '../urls';

describe('parseUrl', () => {
  it('strips protocol and www., keeping the bare host', () => {
    expect(parseUrl('https://www.governance.ai')).toEqual({
      href: 'https://www.governance.ai/',
      label: 'governance.ai',
    });
    expect(parseUrl('http://example.com')?.label).toBe('example.com');
  });

  it('appends /… when there is a path, query, or fragment', () => {
    expect(parseUrl('https://www.governance.ai/post/x?ref=1')?.label).toBe('governance.ai/…');
    expect(parseUrl('https://example.com/a')?.label).toBe('example.com/…');
    expect(parseUrl('https://example.com/?q=1')?.label).toBe('example.com/…');
    expect(parseUrl('https://example.com/#top')?.label).toBe('example.com/…');
  });

  it('accepts a leading www. without a protocol and links via https', () => {
    expect(parseUrl('www.example.com/path')).toEqual({
      href: 'https://www.example.com/path',
      label: 'example.com/…',
    });
  });

  it('preserves the full href for linking', () => {
    expect(parseUrl('https://a.com/b?c=d#e')?.href).toBe('https://a.com/b?c=d#e');
  });

  it('returns null for non-URL titles', () => {
    expect(parseUrl('Buy milk')).toBeNull();
    expect(parseUrl('read https://example.com later')).toBeNull(); // has spaces
    expect(parseUrl('')).toBeNull();
    expect(parseUrl('   ')).toBeNull();
    expect(parseUrl('www.foo')).toBeNull(); // no domain dot after strip
    expect(parseUrl('http://localhost')).toBeNull(); // no dot
    expect(parseUrl('ftp://example.com')).toBeNull(); // unsupported scheme
    expect(parseUrl('just.text')).toBeNull(); // no protocol / www.
  });

  it('trims surrounding whitespace', () => {
    expect(parseUrl('  https://example.com  ')?.label).toBe('example.com');
  });
});

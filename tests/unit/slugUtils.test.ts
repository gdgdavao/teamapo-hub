import { describe, it, expect } from 'vitest';
import { generateSlug, generateUniqueSlug } from '../../src/utils/slugUtils';

describe('generateSlug', () => {
  it('lowercases and hyphenates words', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('strips diacritics and converts & to and', () => {
    expect(generateSlug('Café & Bar')).toBe('cafe-and-bar');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(generateSlug('  Flutter   Forward  ')).toBe('flutter-forward');
  });

  it('strips special characters outside a-z0-9 and hyphens', () => {
    expect(generateSlug('I/O Extended 2026!')).toBe('io-extended-2026');
  });

  it('caps output at 60 characters with no trailing hyphen', () => {
    const long = 'abcdefghij '.repeat(7); // 77 chars
    const slug = generateSlug(long);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toMatch(/-$/);
  });

  it('returns empty string for empty input', () => {
    expect(generateSlug('')).toBe('');
  });

  it('handles input that is only special characters', () => {
    expect(generateSlug('!@#$%^')).toBe('');
  });

  it('handles numeric-only input', () => {
    expect(generateSlug('2026')).toBe('2026');
  });
});

describe('generateUniqueSlug', () => {
  it('returns base slug when not in existing list', () => {
    expect(generateUniqueSlug('My Event', [])).toBe('my-event');
    expect(generateUniqueSlug('My Event', ['other-slug'])).toBe('my-event');
  });

  it('appends a 4-char alphanumeric suffix when slug already exists', () => {
    const result = generateUniqueSlug('My Event', ['my-event']);
    expect(result).toMatch(/^my-event-[a-z0-9]{4}$/);
  });

  it('does not mutate the existing slugs array', () => {
    const existing = ['flutter-workshop'];
    generateUniqueSlug('Flutter Workshop', existing);
    expect(existing).toHaveLength(1);
    expect(existing[0]).toBe('flutter-workshop');
  });
});

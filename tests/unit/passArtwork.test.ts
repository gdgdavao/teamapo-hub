import { describe, it, expect } from 'vitest';
import {
  sha256Sync,
  selectArtworkIndex,
  getArtworkUrl,
  splitAttendeeName,
} from '../../src/utils/passArtwork';
import { PASS_ARTWORK_URLS } from '../../src/config/app';

describe('passArtwork utility', () => {
  it('computes correct SHA-256 matching official test vectors', () => {
    // Empty string
    expect(sha256Sync('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    // Known vector matching Python hashlib
    expect(sha256Sync('reg-12345')).toBe(
      '11a2cdddb3efc46db5c7d57bddd9113508c1039649fb220d4e64f6d1af50665a'
    );
  });

  it('deterministically selects artwork index between 0 and 9', () => {
    const idx = selectArtworkIndex('reg-12345');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(10);
    expect(Number.isInteger(idx)).toBe(true);

    // Calling it multiple times returns the exact same index
    for (let i = 0; i < 20; i++) {
      expect(selectArtworkIndex('reg-12345')).toBe(idx);
    }
  });

  it('distributes indexes across different registration IDs', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `REG-2026-DVO-${i}`);
    const indexes = ids.map(selectArtworkIndex);

    // Indexes are within bounds
    indexes.forEach((idx) => {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(PASS_ARTWORK_URLS.length);
    });

    // Contains distinct values
    const unique = new Set(indexes);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('resolves valid artwork URLs from PASS_ARTWORK_URLS', () => {
    const url = getArtworkUrl('reg-12345');
    expect(PASS_ARTWORK_URLS).toContain(url);
    expect(url.startsWith('https://assets.gdgdavao.org/passes-assets/')).toBe(true);
  });

  it('guarantees zero PII in artwork URLs (DPA 2012 invariant)', () => {
    const regId = 'reg-private-uuid-987654';
    const attendeeEmail = 'juan.delacruz@example.com';
    const attendeeName = 'Juan Dela Cruz';

    const url = getArtworkUrl(regId);

    // URL must NEVER contain personal data or registration IDs
    expect(url).not.toContain(regId);
    expect(url).not.toContain(attendeeEmail);
    expect(url).not.toContain('Juan');
    expect(url).not.toContain('Cruz');
  });

  describe('splitAttendeeName', () => {
    it('splits explicit firstName and lastName', () => {
      const split = splitAttendeeName({ firstName: 'Juan John', lastName: 'Dela Cruz' });
      expect(split.display).toBe('Juan John');
      expect(split.secondary).toBe('Dela Cruz');
    });

    it('splits compound names with Philippine prefixes', () => {
      const split = splitAttendeeName('Juan John Dela Cruz');
      expect(split.display).toBe('Juan John');
      expect(split.secondary).toBe('Dela Cruz');
    });

    it('splits 3-token names into first name and last name', () => {
      const split = splitAttendeeName('Maria Santos Cruz');
      expect(split.display).toBe('Maria Santos');
      expect(split.secondary).toBe('Cruz');
    });

    it('handles single token names', () => {
      const split = splitAttendeeName('Cher');
      expect(split.display).toBe('Cher');
      expect(split.secondary).toBe('');
    });

    it('defaults to Attendee when empty or missing', () => {
      expect(splitAttendeeName(null).display).toBe('Attendee');
      expect(splitAttendeeName('').display).toBe('Attendee');
    });
  });
});

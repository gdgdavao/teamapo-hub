import { describe, it, expect } from 'vitest';
import {
  toDateSafe,
  toISOStringSafe,
  formatDate,
  formatEventDate,
  formatEventTime,
  formatEventDateTime,
  formatTicketDate,
} from '../../src/utils/dateUtils';

describe('dateUtils', () => {
  const sampleEpochSeconds = 1781931600; // Sun May 24 2026 13:00:00 GMT+0800 (05:00:00 UTC)
  const sampleDate = new Date(sampleEpochSeconds * 1000);

  describe('toDateSafe', () => {
    it('returns null for null, undefined, empty string, or invalid strings', () => {
      expect(toDateSafe(null)).toBeNull();
      expect(toDateSafe(undefined)).toBeNull();
      expect(toDateSafe('')).toBeNull();
      expect(toDateSafe('   ')).toBeNull();
      expect(toDateSafe('invalid-date')).toBeNull();
      expect(toDateSafe({})).toBeNull();
      expect(toDateSafe(NaN)).toBeNull();
    });

    it('handles native Date objects', () => {
      expect(toDateSafe(sampleDate)).toEqual(sampleDate);
      expect(toDateSafe(new Date('invalid'))).toBeNull();
    });

    it('handles Firestore Timestamp class instances (.toDate())', () => {
      const mockTimestamp = {
        toDate: () => sampleDate,
      };
      expect(toDateSafe(mockTimestamp)).toEqual(sampleDate);
    });

    it('handles plain objects with seconds and nanoseconds ({ seconds, nanoseconds })', () => {
      const plainObj = { seconds: sampleEpochSeconds, nanoseconds: 0 };
      const parsed = toDateSafe(plainObj);
      expect(parsed).not.toBeNull();
      expect(parsed?.getTime()).toBe(sampleDate.getTime());
    });

    it('handles plain objects with _seconds and _nanoseconds', () => {
      const internalObj = { _seconds: sampleEpochSeconds, _nanoseconds: 0 };
      const parsed = toDateSafe(internalObj);
      expect(parsed).not.toBeNull();
      expect(parsed?.getTime()).toBe(sampleDate.getTime());
    });

    it('handles string seconds in plain objects', () => {
      const strObj = { seconds: String(sampleEpochSeconds), nanoseconds: 0 };
      const parsed = toDateSafe(strObj);
      expect(parsed).not.toBeNull();
      expect(parsed?.getTime()).toBe(sampleDate.getTime());
    });

    it('handles unix timestamps in seconds (< 1e11)', () => {
      const parsed = toDateSafe(sampleEpochSeconds);
      expect(parsed).not.toBeNull();
      expect(parsed?.getTime()).toBe(sampleDate.getTime());
    });

    it('handles unix timestamps in milliseconds (>= 1e11)', () => {
      const parsed = toDateSafe(sampleDate.getTime());
      expect(parsed).not.toBeNull();
      expect(parsed?.getTime()).toBe(sampleDate.getTime());
    });

    it('handles ISO date strings and purely numeric strings', () => {
      const iso = sampleDate.toISOString();
      expect(toDateSafe(iso)?.getTime()).toBe(sampleDate.getTime());
      expect(toDateSafe(String(sampleEpochSeconds))?.getTime()).toBe(sampleDate.getTime());
    });
  });

  describe('toISOStringSafe', () => {
    it('returns valid ISO strings or fallback', () => {
      expect(toISOStringSafe(sampleDate)).toBe(sampleDate.toISOString());
      expect(toISOStringSafe({ seconds: sampleEpochSeconds })).toBe(sampleDate.toISOString());
      expect(toISOStringSafe(null)).toBe('');
      expect(toISOStringSafe(null, 'FALLBACK')).toBe('FALLBACK');
    });
  });

  describe('formatDate and formatEventDate', () => {
    it('formats plain Firestore timestamp objects without returning Date TBD or N/A', () => {
      const plainObj = { seconds: sampleEpochSeconds, nanoseconds: 0 };
      expect(formatDate(plainObj)).toContain('2026');
      expect(formatEventDate(plainObj)).toContain('2026');
    });

    it('returns fallback for invalid or null dates', () => {
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(null, 'TBD')).toBe('TBD');
      expect(formatEventDate(null)).toBe('Date TBD');
      expect(formatEventDate(undefined)).toBe('Date TBD');
      expect(formatEventDate('invalid')).toBe('Date TBD');
    });
  });

  describe('formatEventTime', () => {
    it('formats valid times and returns empty string for null', () => {
      const plainObj = { seconds: sampleEpochSeconds, nanoseconds: 0 };
      expect(formatEventTime(plainObj)).toMatch(/\d+:\d+\s+(AM|PM)/);
      expect(formatEventTime(null)).toBe('');
    });
  });

  describe('formatEventDateTime', () => {
    const endEpochSeconds = sampleEpochSeconds + 4 * 3600; // 4 hours later (same day)
    const multiDayEpochSeconds = sampleEpochSeconds + 26 * 3600; // next day

    it('formats single event date & time when end date is omitted', () => {
      const formatted = formatEventDateTime({ seconds: sampleEpochSeconds });
      expect(formatted).toContain('2026');
      expect(formatted).toContain('at');
      expect(formatted).not.toContain('Date TBD');
    });

    it('formats same-day ranges with bullet separator and time range', () => {
      const formatted = formatEventDateTime(
        { seconds: sampleEpochSeconds },
        { seconds: endEpochSeconds },
        'Asia/Manila'
      );
      expect(formatted).toContain('2026');
      expect(formatted).toContain('•');
      expect(formatted).toContain('–');
      expect(formatted).toContain('(Asia/Manila)');
    });

    it('formats multi-day ranges', () => {
      const formatted = formatEventDateTime(
        { seconds: sampleEpochSeconds },
        { seconds: multiDayEpochSeconds }
      );
      expect(formatted).toContain('–');
      expect(formatted).toContain('2026');
    });

    it('returns Date TBD when start date is invalid or null', () => {
      expect(formatEventDateTime(null)).toBe('Date TBD');
      expect(formatEventDateTime(undefined)).toBe('Date TBD');
      expect(formatEventDateTime('invalid')).toBe('Date TBD');
    });
  });

  describe('formatTicketDate', () => {
    it('formats a date to MM/DD/YYYY h:mmA in Asia/Manila timezone', () => {
      // 2025-09-21T02:00:00Z is 2025-09-21 10:00:00 in Asia/Manila (UTC+8)
      const targetDate = new Date('2025-09-21T02:00:00.000Z');
      const formatted = formatTicketDate(targetDate, 'Asia/Manila');
      expect(formatted).toBe('09/21/2025 10:00AM');
    });

    it('handles afternoon times correctly with PM suffix', () => {
      // 2025-09-21T06:30:00Z is 2025-09-21 14:30:00 in Asia/Manila -> 2:30PM
      const targetDate = new Date('2025-09-21T06:30:00.000Z');
      const formatted = formatTicketDate(targetDate, 'Asia/Manila');
      expect(formatted).toBe('09/21/2025 2:30PM');
    });

    it('returns custom fallback when input is invalid or missing', () => {
      expect(formatTicketDate(null)).toBe('Date TBD');
      expect(formatTicketDate(undefined, 'Asia/Manila', 'TBD')).toBe('TBD');
      expect(formatTicketDate('invalid-date')).toBe('Date TBD');
    });
  });
});

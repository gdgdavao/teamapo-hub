/**
 * The dashboard and analytics charts are only trustworthy if bucketing is
 * stable and correctly zoned. The original implementation keyed buckets on
 * `toISOString().split('T')[0]` (UTC), which for a UTC+8 platform moved every
 * registration made before 08:00 local onto the previous day's bar.
 *
 * These tests pin:
 *  - Asia/Manila bucketing, including the early-morning boundary
 *  - bucket counts and Monday/month anchoring
 *  - that bucketing does NOT depend on the machine's timezone (the guarantee
 *    that an admin abroad sees the same bars as one in Davao)
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  REPORTING_TIMEZONE,
  RANGE_DAYS,
  TREND_RANGES,
  bucketRegistrationCounts,
  bucketRevenue,
  buildBuckets,
  buildDateBuckets,
  formatBucketLabel,
  formatBucketRange,
  granularityForRange,
  toDate,
  toReportingDateKey,
  countWithinWindow,
} from '../../src/utils/analyticsBuckets';

const originalTz = process.env.TZ;

/** Run `fn` with TZ forced, so we can prove the viewer's zone is irrelevant. */
const inTimezone = (tz: string, fn: () => void) => {
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    process.env.TZ = originalTz;
  }
};

afterEach(() => {
  process.env.TZ = originalTz;
});

describe('reporting timezone', () => {
  it('is pinned to Manila, not the viewer', () => {
    expect(REPORTING_TIMEZONE).toBe('Asia/Manila');
  });

  it('files a pre-08:00 PHT registration on the correct local day', () => {
    // 2026-10-05 01:00 PHT == 2026-10-04 17:00 UTC. Under the old UTC keying
    // this landed on Oct 4 and was charted a day early.
    expect(toReportingDateKey(new Date('2026-10-04T17:00:00Z'))).toBe('2026-10-05');
  });

  it('files an evening PHT registration on the same local day', () => {
    // 2026-10-05 20:00 PHT == 2026-10-05 12:00 UTC
    expect(toReportingDateKey(new Date('2026-10-05T12:00:00Z'))).toBe('2026-10-05');
  });

  it('produces identical keys in every viewer timezone', () => {
    const instant = new Date('2026-10-04T17:00:00Z');
    const expected = '2026-10-05';
    for (const tz of ['UTC', 'Asia/Manila', 'America/Los_Angeles', 'Europe/Berlin', 'Pacific/Kiritimati']) {
      inTimezone(tz, () => {
        expect(toReportingDateKey(instant)).toBe(expected);
      });
    }
  });

  it('keeps bucket sequences identical across viewer timezones', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    const reference = buildBuckets(90, 'week', now);
    for (const tz of ['UTC', 'America/Los_Angeles', 'Europe/Berlin', 'Asia/Tokyo']) {
      inTimezone(tz, () => {
        expect(buildBuckets(90, 'week', now)).toEqual(reference);
      });
    }
  });
});

describe('toDate', () => {
  it('normalises Firestore Timestamps, Dates, epochs and ISO strings', () => {
    const expected = '2026-10-05T00:00:00.000Z';
    expect(toDate({ toDate: () => new Date(expected) })?.toISOString()).toBe(expected);
    expect(toDate(new Date(expected))?.toISOString()).toBe(expected);
    expect(toDate(expected)?.toISOString()).toBe(expected);
    expect(toDate(Date.parse(expected))?.toISOString()).toBe(expected);
  });

  it('returns null for unusable input rather than an Invalid Date', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('not a date')).toBeNull();
    expect(toDate(new Date('nope'))).toBeNull();
  });
});

describe('buildBuckets', () => {
  const now = new Date('2026-10-04T12:00:00Z'); // a Sunday

  it('produces exactly `days` daily buckets ending on the current day', () => {
    const keys = buildBuckets(30, 'day', now);
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe('2026-09-05');
    expect(keys[keys.length - 1]).toBe('2026-10-04');
  });

  it('produces contiguous, ascending, duplicate-free daily keys', () => {
    const keys = buildBuckets(30, 'day', now);
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 1; i < keys.length; i += 1) {
      const prev = Date.parse(`${keys[i - 1]}T12:00:00Z`);
      const curr = Date.parse(`${keys[i]}T12:00:00Z`);
      expect(curr - prev).toBe(86_400_000);
    }
  });

  it('anchors weekly buckets to Monday and covers the whole window', () => {
    const keys = buildBuckets(90, 'week', now);
    expect(keys[0]).toBe('2026-07-06');
    // 2026-10-04 is a Sunday, so the final bucket is the week of Mon Sep 28.
    expect(keys[keys.length - 1]).toBe('2026-09-28');
    for (const key of keys) {
      expect(new Date(`${key}T12:00:00Z`).getUTCDay()).toBe(1);
    }
    expect(keys.length).toBeGreaterThanOrEqual(13);
    expect(keys.length).toBeLessThanOrEqual(15);
  });

  it('anchors monthly buckets to the first of the month', () => {
    const keys = buildBuckets(365, 'month', now);
    expect(keys).toContain('2026-10-01');
    expect(keys).toContain('2025-10-01');
    for (const key of keys) expect(key.endsWith('-01')).toBe(true);
    expect(keys.length).toBe(13);
  });

  it('keeps bar counts low enough to stay legible', () => {
    // The reason coarse granularities exist: 365 daily bars render as hairlines.
    expect(buildBuckets(365, 'day', now)).toHaveLength(365);
    expect(buildBuckets(365, 'week', now).length).toBeLessThan(60);
    expect(buildBuckets(365, 'month', now).length).toBeLessThan(15);
  });

  it('returns nothing for a non-positive window', () => {
    expect(buildBuckets(0, 'day', now)).toEqual([]);
    expect(buildBuckets(-5, 'day', now)).toEqual([]);
  });
});

describe('granularityForRange', () => {
  it('keeps 30 days daily and coarsens 90 days to weekly', () => {
    expect(granularityForRange('30d')).toBe('day');
    expect(granularityForRange('90d')).toBe('week');
  });

  it('exposes exactly the two dashboard ranges', () => {
    expect(TREND_RANGES.map((r) => r.value)).toEqual(['30d', '90d']);
    expect(RANGE_DAYS).toEqual({ '30d': 30, '90d': 90 });
  });
});

describe('series bucketing', () => {
  const now = new Date('2026-10-04T12:00:00Z');

  it('pre-seeds every bucket to zero so quiet days are visible', () => {
    const buckets = buildBuckets(7, 'day', now);
    const counts = bucketRegistrationCounts([], buckets);
    expect(counts).toHaveLength(7);
    expect(counts.every((b) => b.count === 0)).toBe(true);
  });

  it('files a registration into the bucket for its Manila day', () => {
    const buckets = buildBuckets(7, 'day', now);
    // 2026-10-03 02:00 PHT == 2026-10-02 18:00 UTC -> Oct 3, not Oct 2
    const counts = bucketRegistrationCounts(
      [{ registrationDate: new Date('2026-10-02T18:00:00Z') }],
      buckets
    );
    expect(counts.find((b) => b.key === '2026-10-03')?.count).toBe(1);
    expect(counts.find((b) => b.key === '2026-10-02')?.count).toBe(0);
  });

  it('excludes registrations outside the window instead of inventing buckets', () => {
    const buckets = buildBuckets(7, 'day', now);
    const counts = bucketRegistrationCounts(
      [{ registrationDate: new Date('2020-01-01T00:00:00Z') }],
      buckets
    );
    expect(counts).toHaveLength(7);
    expect(counts.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it('skips registrations with no usable date', () => {
    const buckets = buildBuckets(3, 'day', now);
    const counts = bucketRegistrationCounts(
      [{ registrationDate: null }, {}, { registrationDate: 'garbage' }],
      buckets
    );
    expect(counts.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it('sums revenue across paid registrations only', () => {
    const buckets = buildBuckets(3, 'day', now);
    const revenue = bucketRevenue(
      [
        { registrationDate: new Date('2026-10-03T02:00:00Z'), paymentStatus: 'paid', totalAmount: 500 },
        { registrationDate: new Date('2026-10-03T03:00:00Z'), paymentStatus: 'paid', totalAmount: 250 },
        { registrationDate: new Date('2026-10-03T04:00:00Z'), paymentStatus: 'pending', totalAmount: 999 },
        { registrationDate: new Date('2026-10-03T05:00:00Z'), paymentStatus: 'refunded', totalAmount: 999 },
      ],
      buckets
    );
    const target = revenue.find((b) => b.key === '2026-10-03');
    expect(target?.amount).toBe(750);
    expect(revenue.reduce((s, b) => s + b.amount, 0)).toBe(750);
  });

  it('treats a missing totalAmount as zero, never NaN', () => {
    const buckets = buildBuckets(2, 'day', now);
    const revenue = bucketRevenue(
      [{ registrationDate: new Date('2026-10-04T04:00:00Z'), paymentStatus: 'paid' }],
      buckets
    );
    expect(revenue.some((b) => Number.isNaN(b.amount))).toBe(false);
  });
});

describe('labels', () => {
  it('formats a day key as a short calendar date', () => {
    expect(formatBucketLabel('2026-10-04', 'day')).toBe('Oct 4');
  });

  it('does not shift the calendar day when formatting', () => {
    // Formatting must not route through the viewer's zone, or midnight-ish keys
    // render as the day before for anyone west of UTC.
    for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Honolulu']) {
      inTimezone(tz, () => {
        expect(formatBucketLabel('2026-01-01', 'day')).toBe('Jan 1');
      });
    }
  });

  it('labels a weekly bucket with the span it covers', () => {
    expect(formatBucketRange('2026-10-05', 'week')).toBe('Oct 5 – Oct 11');
  });

  it('labels a monthly bucket with month and year', () => {
    expect(formatBucketLabel('2026-10-01', 'month')).toBe('Oct 26');
  });

  it('labels a monthly bucket span with the last day of that month', () => {
    // February 2026 has 28 days; the span must not bleed into March.
    expect(formatBucketRange('2026-02-01', 'month')).toBe('Feb 26 – Feb 28');
  });
});

describe('buildDateBuckets', () => {
  it('delegates to buildBuckets with the range length', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(buildDateBuckets('30d', 'day', now)).toEqual(buildBuckets(30, 'day', now));
    expect(buildDateBuckets('90d', 'week', now)).toEqual(buildBuckets(90, 'week', now));
  });

  it('defaults granularity from the range', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(buildDateBuckets('90d', undefined, now)).toHaveLength(
      buildBuckets(90, 'week', now).length
    );
  });
});

describe('countWithinWindow', () => {
  const from = new Date('2026-10-01T00:00:00.000Z');
  const to = new Date('2026-10-31T23:59:59.999Z');

  it('counts instants inside an inclusive window', () => {
    const values = [
      new Date('2026-09-30T23:59:59.999Z'), // before
      new Date('2026-10-01T00:00:00.000Z'), // on lower boundary
      new Date('2026-10-15T12:00:00.000Z'), // inside
      new Date('2026-10-31T23:59:59.999Z'), // on upper boundary
      new Date('2026-11-01T00:00:00.000Z'), // after
    ];
    expect(countWithinWindow(values, from, to)).toBe(3);
  });

  it('treats missing `to` parameter as an open-ended window', () => {
    const values = [
      new Date('2026-09-30T23:59:59.999Z'), // before
      new Date('2026-10-01T00:00:00.000Z'), // on boundary
      new Date('2026-10-15T12:00:00.000Z'), // inside
      new Date('2027-01-01T00:00:00.000Z'), // far future
    ];
    expect(countWithinWindow(values, from)).toBe(3);
  });

  it('skips unparseable, null, and undefined values without throwing or miscounting', () => {
    const values = [
      null,
      undefined,
      'not-a-date',
      new Date('2026-10-15T00:00:00.000Z'),
    ];
    expect(countWithinWindow(values, from, to)).toBe(1);
  });

  it('normalises Firestore Timestamp objects with toDate() methods', () => {
    const timestampLike = {
      toDate: () => new Date('2026-10-15T10:00:00.000Z'),
    };
    expect(countWithinWindow([timestampLike], from, to)).toBe(1);
  });
});
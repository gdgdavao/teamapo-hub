/**
 * Time-bucketing for the dashboard and analytics trend charts.
 *
 * Pure functions only — no Firebase, no React. Both dashboards and the
 * analytics page chart the same series, so the bucketing has to agree between
 * them or the two screens will tell different stories about the same week.
 *
 * ## Why the timezone is pinned rather than "local"
 *
 * This used to key buckets on `toISOString().split('T')[0]`, which is UTC. For a
 * Philippines-only platform (UTC+8, no DST) that silently moved every
 * registration made before 08:00 local onto the previous day's bar, and printed
 * UTC dates on the axis for a Manila-time audience.
 *
 * We deliberately do *not* use the browser's local zone either. An admin
 * checking the dashboard from abroad or behind a VPN would otherwise see
 * different bars for the same data, which is worse than a fixed offset.
 *
 * To retarget this at another region, change REPORTING_TIMEZONE and nothing
 * else — every label and bucket derives from it.
 */

import { toDateSafe, DateInput } from './dateUtils';

export const REPORTING_TIMEZONE = 'Asia/Manila';

export type TrendRange = '30d' | '90d';
export type BucketGranularity = 'day' | 'week' | 'month';

/** Days of history each range covers. */
export const RANGE_DAYS: Record<TrendRange, number> = {
  '30d': 30,
  '90d': 90,
};

export const TREND_RANGES: ReadonlyArray<{ value: TrendRange; label: string }> = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

/**
 * 30 days of daily bars is already readable; 90 daily bars would render as
 * hairlines. Weekly aggregation keeps the bar count in the low teens.
 */
export const granularityForRange = (range: TrendRange): BucketGranularity =>
  range === '30d' ? 'day' : 'week';

/* -------------------------------------------------------------------------- */
/* Key formatting                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Assemble `YYYY-MM-DD` from the formatter's own parts.
 *
 * This used to be `new Intl.DateTimeFormat('en-CA', ...)` and `.format()`,
 * which is shorter and depends on `en-CA` resolving to that pattern. That is
 * ICU *locale data*, not an engine feature: on a reduced-ICU build the locale
 * silently falls back to `en-US`, the key becomes `MM/DD/YYYY`, and every
 * bucket on the trend chart quietly mismatches with no error anywhere. Reading
 * the named parts off the formatter gets the same zone conversion and the same
 * digits from any ICU, and an unrecognised part is visible rather than silent.
 */
const reportingDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORTING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Anything Firestore or a caller might hand us for a timestamp. */
export type DateLike = DateInput;

/** Normalise a Firestore Timestamp / Date / epoch / ISO string to a Date. */
export const toDate = (value: DateLike): Date | null => toDateSafe(value);

/**
 * The `YYYY-MM-DD` calendar date an instant falls on *in the reporting zone*.
 * This is the canonical bucket key format.
 */
export const toReportingDateKey = (value: DateLike): string | null => {
  const date = toDate(value);
  if (!date) return null;

  const parts: Record<string, string> = {};
  for (const part of reportingDayFormatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/* -------------------------------------------------------------------------- */
/* Key arithmetic                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Anchor every key at UTC noon before doing date math.
 *
 * Shifting a UTC-midnight date by exactly 86400000ms is only safe if no DST
 * transition intervenes — which is not true in the *viewer's* zone (a viewer in
 * Berlin shifting across a DST boundary would land on 23:00 or 01:00 and roll
 * the day over). Noon UTC has no such transition anywhere on earth, so this is
 * stable regardless of where the browser is.
 */
const keyToUtcNoon = (key: string): Date => new Date(`${key}T12:00:00Z`);

const shiftKey = (key: string, days: number): string => {
  const shifted = new Date(keyToUtcNoon(key).getTime() + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
};

/** Monday-anchored start of the week containing `key`. */
const startOfWeekKey = (key: string): string => {
  const dayOfWeek = keyToUtcNoon(key).getUTCDay(); // 0 = Sunday
  const offsetFromMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return shiftKey(key, offsetFromMonday);
};

/** First of the month containing `key`. */
const startOfMonthKey = (key: string): string => `${key.slice(0, 7)}-01`;

/**
 * Calendar month arithmetic on a `YYYY-MM-DD` key.
 *
 * Stepping months by adding 28/30/31 days is wrong: it lands on the wrong month
 * for every month shorter than the one you started from, and 32 days was
 * already enough to skip a month entirely. Advance the year/month fields
 * instead and re-normalise.
 */
const addMonthsKey = (key: string, months: number): string => {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  // Convert to a 0-based absolute month so December wraps cleanly.
  const absolute = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = (absolute % 12) + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
};

/** Last calendar day of the month containing `key`. */
const endOfMonthKey = (key: string): string =>
  shiftKey(addMonthsKey(startOfMonthKey(key), 1), -1);

/**
 * Ordered bucket keys covering the trailing `days` window, oldest first.
 *
 * The first bucket of a week or month range is partial — the window starts
 * mid-period. That's deliberate: dropping it would silently shorten the window
 * and understate the total shown in the panel summary.
 */
export const buildBuckets = (
  days: number,
  granularity: BucketGranularity = 'day',
  now: DateLike = new Date()
): string[] => {
  if (days <= 0) return [];

  const endKey = toReportingDateKey(now);
  if (!endKey) return [];

  const startKey = shiftKey(endKey, -(days - 1));

  if (granularity === 'day') {
    const keys: string[] = [];
    for (let offset = 0; offset < days; offset += 1) {
      keys.push(shiftKey(startKey, offset));
    }
    return keys;
  }

  if (granularity === 'month') {
    const first = startOfMonthKey(startKey);
    const last = startOfMonthKey(endKey);
    const keys: string[] = [];
    // Bound the walk generously; the loop stops as soon as it passes `last`.
    for (let offset = 0; offset < 60; offset += 1) {
      const key = addMonthsKey(first, offset);
      if (key > last) break;
      keys.push(key);
    }
    return keys;
  }

  const firstWeek = startOfWeekKey(startKey);
  const lastWeek = startOfWeekKey(endKey);
  const keys: string[] = [];
  for (let offset = 0; offset <= days; offset += 7) {
    const key = shiftKey(firstWeek, offset);
    if (key > lastWeek) break;
    keys.push(key);
  }
  return keys;
};

/** Bucket keys for one of the dashboard's fixed ranges. */
export const buildDateBuckets = (
  range: TrendRange,
  granularity: BucketGranularity = granularityForRange(range),
  now: DateLike = new Date()
): string[] => buildBuckets(RANGE_DAYS[range], granularity, now);

/* -------------------------------------------------------------------------- */
/* Series                                                                     */
/* -------------------------------------------------------------------------- */

export interface CountBucket {
  key: string;
  count: number;
}

export interface AmountBucket {
  key: string;
  amount: number;
}

/** Minimal shape needed to bucket a registration. */
export interface BucketableRegistration {
  registrationDate?: DateLike;
  paymentStatus?: string;
  totalAmount?: number;
}

const resolveBucketKey = (
  dayKey: string,
  bucketMap: Map<string, number>,
  granularity?: BucketGranularity
): string | null => {
  if (granularity === 'day') {
    return bucketMap.has(dayKey) ? dayKey : null;
  }
  if (granularity === 'week') {
    const monday = startOfWeekKey(dayKey);
    return bucketMap.has(monday) ? monday : null;
  }
  if (granularity === 'month') {
    const month = startOfMonthKey(dayKey);
    return bucketMap.has(month) ? month : null;
  }
  if (bucketMap.has(dayKey)) return dayKey;
  const monday = startOfWeekKey(dayKey);
  if (bucketMap.has(monday)) return monday;
  const month = startOfMonthKey(dayKey);
  if (bucketMap.has(month)) return month;
  return null;
};

const toBucket = (
  registrations: readonly BucketableRegistration[],
  buckets: readonly string[],
  granularity?: BucketGranularity
) => {
  const counts = new Map<string, number>(buckets.map((key) => [key, 0]));
  for (const registration of registrations) {
    const rawKey = toReportingDateKey(registration.registrationDate);
    if (!rawKey) continue;
    const bucketKey = resolveBucketKey(rawKey, counts, granularity);
    // Registrations outside the window land in no bucket by design — the chart
    // shows the window, not all time.
    if (bucketKey && counts.has(bucketKey)) {
      counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + 1);
    }
  }
  return counts;
};

/**
 * Registrations per bucket across the whole window.
 *
 * Buckets are pre-seeded to zero so gaps render as real gaps rather than the
 * chart silently compressing away quiet days.
 */
export const bucketRegistrationCounts = (
  registrations: readonly BucketableRegistration[],
  buckets: readonly string[],
  granularity?: BucketGranularity
): CountBucket[] => {
  const counts = toBucket(registrations, buckets, granularity);
  return buckets.map((key) => ({ key, count: counts.get(key) ?? 0 }));
};

/** Collected revenue per bucket. Only `paid` registrations count as revenue. */
export const bucketRevenue = (
  registrations: readonly BucketableRegistration[],
  buckets: readonly string[],
  granularity?: BucketGranularity
): AmountBucket[] => {
  const amounts = new Map<string, number>(buckets.map((key) => [key, 0]));
  for (const registration of registrations) {
    if (registration.paymentStatus !== 'paid') continue;
    const rawKey = toReportingDateKey(registration.registrationDate);
    if (!rawKey) continue;
    const bucketKey = resolveBucketKey(rawKey, amounts, granularity);
    if (bucketKey && amounts.has(bucketKey)) {
      amounts.set(bucketKey, (amounts.get(bucketKey) ?? 0) + (registration.totalAmount ?? 0));
    }
  }
  return buckets.map((key) => ({ key, amount: amounts.get(key) ?? 0 }));
};

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

const labelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', // the key is already a calendar date; never re-shift it
  month: 'short',
  day: 'numeric',
});

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  year: '2-digit',
});

/**
 * Axis label for a bucket key.
 *
 * Weekly buckets are labelled by their Monday start, which is what the bar
 * actually covers from; monthly buckets by month and year, since "Oct 1"
 * repeated across a whole month reads like a data bug.
 */
export const formatBucketLabel = (
  key: string,
  granularity: BucketGranularity = 'day'
): string =>
  granularity === 'month'
    ? monthLabelFormatter.format(keyToUtcNoon(key)).replace(/[\u2019']/g, '')
    : labelFormatter.format(keyToUtcNoon(key));

/** Human label for a bucket's span, used in tooltips and the aria summary. */
export const formatBucketRange = (
  key: string,
  granularity: BucketGranularity
): string => {
  if (granularity === 'day') return formatBucketLabel(key, granularity);
  if (granularity === 'month') {
    return `${formatBucketLabel(key, granularity)} – ${formatBucketLabel(
      endOfMonthKey(key),
      'day'
    )}`;
  }
  return `${formatBucketLabel(key, granularity)} – ${formatBucketLabel(shiftKey(key, 6), 'day')}`;
};

/** Short noun for a granularity, for captions and empty states. */
export const GRANULARITY_NOUN: Record<BucketGranularity, string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
};

/**
 * How many of these instants fall inside an inclusive window.
 *
 * Exists so month-over-month counts can be taken off a snapshot the caller
 * already holds, instead of asking Firestore for a filtered copy of a
 * collection that was just read in full anyway. Firestore bills per document
 * read, so the second query was the same documents at the same price.
 *
 * If `to` is omitted, the window is open-ended (`[from, ∞)`).
 * Unparseable instants are skipped rather than counted as "not in the window":
 * a document with no timestamp has no month, and quietly folding it into either
 * bucket would make the growth percentage disagree with both.
 */
export const countWithinWindow = (
  values: readonly DateLike[],
  from: Date,
  to?: Date
): number => {
  const fromMs = from.getTime();
  const toMs = to ? to.getTime() : Infinity;
  let count = 0;
  for (const value of values) {
    const date = toDate(value);
    if (!date) continue;
    const ms = date.getTime();
    if (ms >= fromMs && ms <= toMs) count += 1;
  }
  return count;
};
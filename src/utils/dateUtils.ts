/**
 * Centralized Date & Timestamp Utilities
 *
 * Provides resilient, pure functions for converting and formatting dates across
 * Firestore Timestamps, plain serialized objects ({ seconds, nanoseconds }),
 * ISO strings, and unix epoch numbers.
 */

/**
 * Anything that can represent an instant in time across Firestore, network payloads, and UI.
 */
export type DateInput =
  | Date
  | number
  | string
  | { toDate: () => Date }
  | { seconds: number | string; nanoseconds?: number | string }
  | { _seconds: number | string; _nanoseconds?: number | string }
  | null
  | undefined;

/**
 * Safely parses any date-like representation into a valid JavaScript Date,
 * or returns null if missing, invalid, or unparseable.
 */
export function toDateSafe(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Native Date instance
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Firestore Timestamp instance with .toDate()
  if (typeof (value as any).toDate === 'function') {
    try {
      const d = (value as any).toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return d;
      }
    } catch {
      // Fall through to other checks
    }
  }

  // Plain Firestore Timestamp map object ({ seconds, nanoseconds } or { _seconds, _nanoseconds })
  if (typeof value === 'object') {
    const rawSeconds = (value as any).seconds ?? (value as any)._seconds;
    if (typeof rawSeconds === 'number') {
      const d = new Date(rawSeconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof rawSeconds === 'string' && rawSeconds.trim() !== '' && !isNaN(Number(rawSeconds))) {
      const d = new Date(Number(rawSeconds) * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // Numeric epoch
  if (typeof value === 'number') {
    if (isNaN(value)) return null;
    // Values < 1e11 (100 billion) are treated as seconds (up to year 5138); larger are milliseconds
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // String date or numeric string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Converts a date input to an ISO string safely, falling back to a default value (default: '').
 */
export function toISOStringSafe(value: unknown, fallback: string = ''): string {
  const date = toDateSafe(value);
  return date ? date.toISOString() : fallback;
}

/**
 * Standard date formatting helper for UI lists, labels, and metadata.
 */
export function formatDate(
  value: unknown,
  fallback: string = 'N/A',
  options?: Intl.DateTimeFormatOptions
): string {
  const date = toDateSafe(value);
  if (!date) return fallback;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  return date.toLocaleDateString('en-US', options || defaultOptions);
}

/**
 * Formats date and time (e.g. "May 24, 2026, 01:00 PM"), defaulting to "N/A".
 */
export function formatDateTime(value: unknown, fallback: string = 'N/A'): string {
  return formatDate(value, fallback, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats an event date (e.g. "May 24, 2026"), defaulting to "Date TBD".
 */
export function formatEventDate(value: unknown, fallback: string = 'Date TBD'): string {
  return formatDate(value, fallback, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats an event time (e.g. "1:00 PM").
 */
export function formatEventTime(value: unknown): string {
  const date = toDateSafe(value);
  if (!date) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a full event date & time range for event overviews and registration headers.
 * Example output:
 * - Same day: "Sun, May 24, 2026 • 1:00 PM – 5:00 PM (Asia/Manila)"
 * - Multi day: "Sun, May 24, 2026 at 1:00 PM – Mon, May 25, 2026 at 5:00 PM (Asia/Manila)"
 * - Single time: "Sun, May 24, 2026 at 1:00 PM"
 * - Missing start: "Date TBD"
 */
export function formatEventDateTime(
  startVal: unknown,
  endVal?: unknown,
  timezone?: string,
  fallback: string = 'Date TBD'
): string {
  const startDate = toDateSafe(startVal);
  if (!startDate) return fallback;

  const formattedStart = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const startTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const tzSuffix = timezone ? ` (${timezone})` : '';

  const endDate = toDateSafe(endVal);
  if (!endDate) {
    return `${formattedStart} at ${startTime}${tzSuffix}`;
  }

  const endTime = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const isSameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (isSameDay) {
    return `${formattedStart} • ${startTime} – ${endTime}${tzSuffix}`;
  }

  const formattedEnd = endDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${formattedStart} at ${startTime} – ${formattedEnd} at ${endTime}${tzSuffix}`;
}

/**
 * Formats event date and time for the TeamApo Ticket Card footer bar.
 * Produces format: MM/DD/YYYY h:mmA in the specified timezone (default: Asia/Manila).
 * Example: "09/21/2025 10:00AM".
 */
export function formatTicketDate(
  value: unknown,
  timeZone: string = 'Asia/Manila',
  fallback: string = 'Date TBD'
): string {
  const date = toDateSafe(value);
  if (!date) return fallback;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    if (!map.month || !map.day || !map.year || !map.hour || !map.minute || !map.dayPeriod) {
      return fallback;
    }
    return `${map.month}/${map.day}/${map.year} ${map.hour}:${map.minute}${map.dayPeriod.toUpperCase()}`;
  } catch {
    return fallback;
  }
}

/**
 * Extracts calendar (year, month, day) components for a Date in the specified IANA timezone
 * (defaulting to 'Asia/Manila') and returns the UTC midnight epoch for that calendar date.
 */
function toCalendarDayUtcMs(date: Date, timeZone: string = 'Asia/Manila'): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const year = Number(map.year);
    const month = Number(map.month);
    const day = Number(map.day);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return Date.UTC(year, month - 1, day);
    }
  } catch {
    // Fallback to local calendar components if an invalid timezone string was supplied
  }
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Computes the signed integer difference in calendar days `(toDate - fromDate)`
 * in the specified IANA timezone (default: 'Asia/Manila').
 * Example: Nov 6 1:17 PM -> Nov 7 8:00 AM in Asia/Manila returns `1` (tomorrow).
 */
export function getCalendarDaysDiff(
  fromDate: Date,
  toDate: Date,
  timeZone: string = 'Asia/Manila'
): number {
  const fromUtcMidnight = toCalendarDayUtcMs(fromDate, timeZone);
  const toUtcMidnight = toCalendarDayUtcMs(toDate, timeZone);
  return Math.round((toUtcMidnight - fromUtcMidnight) / (1000 * 3600 * 24));
}

export interface EventDateStatus {
  type: 'past' | 'current' | 'future';
  severity: 'none' | 'low' | 'medium' | 'high';
  message: string;
  daysAgo?: number;
  daysUntil?: number;
  canCheckIn: boolean;
}

/**
 * Computes the check-in date awareness status for an event using calendar-day comparisons
 * in the event's timezone (defaulting to 'Asia/Manila').
 */
export function getEventDateStatus(
  event: { startDate?: unknown; endDate?: unknown; timezone?: string } | null | undefined,
  now: Date = new Date()
): EventDateStatus | null {
  if (!event || !event.startDate) return null;

  const eventStartDate = toDateSafe(event.startDate);
  if (!eventStartDate) return null;

  const eventEndDate = toDateSafe(event.endDate) ?? eventStartDate;
  const timeZone = event.timezone || 'Asia/Manila';

  const timeDiffStart = eventStartDate.getTime() - now.getTime();
  const timeDiffEnd = eventEndDate.getTime() - now.getTime();

  // Event is in the past
  if (timeDiffEnd < 0) {
    const daysAgo = Math.max(0, getCalendarDaysDiff(eventEndDate, now, timeZone));
    return {
      type: 'past',
      severity: daysAgo > 7 ? 'high' : daysAgo > 1 ? 'medium' : 'low',
      message:
        daysAgo === 0
          ? 'This event ended today'
          : daysAgo === 1
            ? 'This event ended yesterday'
            : `This event ended ${daysAgo} days ago`,
      daysAgo,
      canCheckIn: daysAgo <= 1, // Allow check-in up to 1 calendar day after event
    };
  }

  // Event is happening now
  if (timeDiffStart <= 0 && timeDiffEnd >= 0) {
    return {
      type: 'current',
      severity: 'none',
      message: 'Event is happening now',
      canCheckIn: true,
    };
  }

  // Event is in the future
  if (timeDiffStart > 0) {
    const daysUntil = Math.max(0, getCalendarDaysDiff(now, eventStartDate, timeZone));
    return {
      type: 'future',
      severity: daysUntil > 7 ? 'high' : daysUntil > 1 ? 'medium' : 'low',
      message:
        daysUntil === 0
          ? 'This event starts today'
          : daysUntil === 1
            ? 'This event starts tomorrow'
            : `This event starts in ${daysUntil} days`,
      daysUntil,
      canCheckIn: daysUntil <= 1, // Allow check-in starting 1 calendar day before event
    };
  }

  return null;
}

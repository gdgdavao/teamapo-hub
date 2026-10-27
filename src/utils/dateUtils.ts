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

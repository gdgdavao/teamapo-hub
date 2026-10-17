/**
 * Single source of truth for "what state is this registration in?".
 *
 * This used to live inline in AdminAttendeesPage as getDisplayStatus(). That
 * made it impossible for any other surface to count pending work without
 * re-implementing the precedence rules — and the dashboard *did*, counting raw
 * `paymentStatus === 'pending'` instead. The two disagreed: failed, refunded and
 * processing payments all resolve to 'pending' here, so the dashboard
 * under-counted relative to the list its own CTA opened.
 *
 * If you change the precedence, change it here only.
 */

/** The display states the attendees UI filters on. */
export type DisplayStatus =
  | 'pending'
  | 'confirmed'
  | 'approved'
  | 'paid'
  | 'attended'
  | 'cancelled'
  | 'rejected';

/** Minimal shape needed to resolve status — satisfied by Firestore Registration docs. */
export interface StatusBearingRegistration {
  attendanceStatus?: string;
  paymentStatus?: string;
  /** Optional explicit admin decision. Written by some flows, absent on others. */
  registrationStatus?: string;
}

/**
 * Resolve a raw registration document to the status shown to organizers.
 *
 * Precedence is deliberate:
 *  1. Attendance wins, so a checked-in attendee never reads as "pending review".
 *  2. Cancellations win next, so a cancelled attendee is never actionable.
 *  3. Explicit rejections win next, preventing rejected attendees from showing as valid.
 *  4. An explicit admin approval (`registrationStatus === 'approved'`) or confirmed
 *     payment (`paymentStatus === 'paid'`) resolves to 'confirmed'.
 *  5. Explicit 'pending' or anything else falls back to 'pending' — an unreviewed
 *     registration is the safe default, keeping it visible in the review backlog.
 */
export const resolveDisplayStatus = (
  reg: StatusBearingRegistration | null | undefined
): DisplayStatus => {
  if (!reg) return 'pending';

  if (reg.attendanceStatus === 'checked-in') return 'attended';
  if (reg.attendanceStatus === 'cancelled') return 'cancelled';

  switch (reg.registrationStatus) {
    case 'approved':
      return 'confirmed';
    case 'rejected':
      return 'rejected';
    case 'pending':
      return 'pending';
  }

  if (reg.paymentStatus === 'paid') return 'confirmed';

  return 'pending';
};

/**
 * Count registrations that still need an organizer decision.
 *
 * Callers use this for the dashboard's "N need review" figure, so it must agree
 * exactly with the row count of an attendees list filtered to 'pending'.
 */
export const countPendingRegistrations = <
  T extends StatusBearingRegistration | null | undefined
>(
  registrations: readonly T[]
): number =>
  registrations.reduce(
    (total, reg) => (resolveDisplayStatus(reg) === 'pending' ? total + 1 : total),
    0
  );
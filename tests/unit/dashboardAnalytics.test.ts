/**
 * Contract tests for the dashboard's pending-review CTA.
 *
 * The CTA advertises a count and deep-links to /attendees?status=pending. That
 * is only honest if three things stay true together:
 *
 *  1. the count is derived from resolveDisplayStatus, not a raw paymentStatus
 *     check (which under-counted and disagreed with the list),
 *  2. it is not truncated to a display-sized slice (the old .slice(0, 5)),
 *  3. the attendees page actually honours ?status=.
 *
 * These are structural assertions on the source. A behavioural render test would
 * be stronger, but both pages pull in Firebase and AuthContext, and the repo's
 * existing dashboard coverage (dashboard-listener-dedup.test.ts) sets the
 * precedent of asserting the shape of these two files directly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const adminDashboard = readFileSync(
  'src/pages/admin/AdminDashboardPage.tsx',
  'utf-8'
);
const attendeesPage = readFileSync(
  'src/pages/admin/AdminAttendeesPage.tsx',
  'utf-8'
);

/** Drop comments so an explanatory note about a call can't satisfy a "not called" check. */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('dashboard pending count', () => {
  it('derives the count from the shared resolver, not a raw paymentStatus check', () => {
    expect(adminDashboard).toContain('countPendingRegistrations');
    // The old inline filter that disagreed with the attendees list.
    expect(adminDashboard).not.toMatch(/paymentStatus\s*===\s*'pending'/);
  });

  it('counts the whole roster rather than a top-N slice', () => {
    // A slice before counting capped the badge at 5 regardless of backlog.
    expect(adminDashboard).not.toMatch(/setPendingCount\([^)]*\.slice\(/);
  });

  it('has no reminder/snooze machinery left behind', () => {
    // Removed in the redesign: the count is permanently visible in the strip,
    // so a 2-hour "Remind Me Later" snooze added ceremony and no information.
    expect(adminDashboard).not.toContain('admin_pending_reminder');
    expect(adminDashboard).not.toContain('Remind Me Later');
    expect(adminDashboard).not.toContain('reminderDismissed');
  });

  it('removes the card grids and the header Create Event action', () => {
    expect(adminDashboard).not.toContain('StatCard');
    expect(adminDashboard).not.toContain('QuickActionCard');
    expect(adminDashboard).not.toContain('AttendeeCard');
    expect(adminDashboard).not.toContain('Recent Events');
    expect(adminDashboard).not.toContain('Latest Pending Attendees');
    // The `actions` slot rendered the navbar Create Event button.
    expect(adminDashboard).not.toMatch(/actions=\{/);
    expect(adminDashboard).not.toContain('/events/create');
  });

  it('renders the shared analytics components instead', () => {
    expect(adminDashboard).toContain('DashboardStatStrip');
    expect(adminDashboard).toContain('DashboardTrendPanel');
  });

  it('renders the range toggle exactly once for both panels', () => {
    // Both panels read the same range, so a second copy would be two controls
    // that can only ever agree — which reads as a bug.
    const toggles = adminDashboard.match(/<TrendRangeToggle/g) ?? [];
    expect(toggles).toHaveLength(1);
  });

  it('keeps the primitive effect deps the dedup test asserts on', () => {
    // currentUser and userProfile are fresh objects on every auth re-render, so
    // depending on them directly would re-fetch in a loop. canReadAll is the
    // boolean that replaced userProfile.role, and it changes only when the role
    // or isActive does.
    expect(adminDashboard).toMatch(
      /fetchDashboardData\(\);[\s\S]*\[currentUser\?\.uid,\s*canReadAll\]/
    );
  });

  it('does not fetch the published-events list it no longer displays', () => {
    // getPublishedEvents existed only to populate "Recent Events".
    expect(adminDashboard).not.toContain('getPublishedEvents');
  });
});

describe('organizer dashboard', () => {
  const organizerDashboard = readFileSync(
    'src/pages/organizer/OrganizerDashboardPage.tsx',
    'utf-8'
  );

  it('never calls the admin-only unscoped dashboard stats', () => {
    // getDashboardStats() runs unscoped reads over registrations and
    // certificates, which firestore.rules denies to organizers and which would
    // breach the Data Privacy Act 2012 even if the rules allowed it.
    const code = withoutComments(organizerDashboard);
    expect(code).not.toContain('getDashboardStats');
    expect(code).not.toContain('getAllRegistrations');
    expect(code).not.toContain('AnalyticsService');
  });

  it('reads only organizer-scoped data', () => {
    expect(organizerDashboard).toContain('getEventsByOrganizer');
    expect(organizerDashboard).toContain('getRegistrationsByOrganizer');
  });

  it('has no hardcoded growth percentages', () => {
    // These were literal strings presented as real month-over-month deltas.
    expect(organizerDashboard).not.toMatch(/'\+\d+%/);
    expect(organizerDashboard).not.toContain('from last month');
  });

  it('points its primary CTA at the next event roster and check-in', () => {
    expect(organizerDashboard).toContain('/events/${nextEvent.id}/attendees');
    expect(organizerDashboard).toContain('/events/${nextEvent.id}/check-in');
  });

  it('renders the range toggle exactly once for both panels', () => {
    const toggles = organizerDashboard.match(/<TrendRangeToggle/g) ?? [];
    expect(toggles).toHaveLength(1);
  });
});

describe('attendees deep-link support', () => {
  it('reads ?status= from the URL', () => {
    expect(attendeesPage).toContain("searchParams.get('status')");
  });

  it('validates the value against the options the select renders', () => {
    // A hand-edited or stale URL must not apply a filter that matches nothing.
    expect(attendeesPage).toContain('isValidStatusFilter');
    expect(attendeesPage).toMatch(
      /STATUS_FILTER_OPTIONS\.some\(\(opt\) => opt\.value === value\)/
    );
  });

  it('re-syncs when the param changes while already on the page', () => {
    // Without this, arriving from a second dashboard CTA keeps the old filter
    // and silently shows the wrong queue.
    expect(attendeesPage).toMatch(
      /useEffect\(\(\) => \{[\s\S]{0,200}setStatusFilter\(isValidStatusFilter\(statusParam\)/ 
    );
  });

  it('drives the select options from the shared list', () => {
    expect(attendeesPage).toMatch(
      /STATUS_FILTER_OPTIONS\.map\(\(opt\) => \(\s*<option key=\{opt\.value\}/
    );
  });
});

describe('check-in deep-link support', () => {
  const checkInPage = readFileSync('src/pages/admin/AdminCheckInPage.tsx', 'utf-8');

  it('honours ?eventId= instead of defaulting to the first event', () => {
    // The dashboard's "Check in" button names one event; landing on a
    // different one at the door is worse than no shortcut.
    expect(checkInPage).toContain("searchParams.get('eventId')");
    expect(checkInPage).toMatch(/setCurrentEvent\(requested \?\? eventList\[0\] \?\? null\)/);
  });
});

describe('create event reachability', () => {
  const manageEventsPage = readFileSync(
    'src/pages/admin/AdminManageEventsPage.tsx',
    'utf-8'
  );

  it('is reachable from the events page header, not only the empty state', () => {
    // The empty-state link was the only remaining entry point once the
    // dashboard buttons were removed, which made creation URL-only for any
    // admin who already had events.
    expect(manageEventsPage).toMatch(/actions=\{[\s\S]{0,400}to="\/events\/create"/);
  });

  it('gates both entry points on the permission, not the raw role', () => {
    // Organizers cannot create events; an ungated CTA sent them to a page they
    // cannot use. This was `userProfile?.role === 'admin'` twice, which counted
    // occurrences of a string rather than checking a rule - and the two CTAs
    // had drifted from the /events/create route gate they lead to. All three now
    // read `read 'all'`, which only admins hold, so they cannot disagree.
    const gates = manageEventsPage.match(/<Can do="read" on="all" passThrough>/g) ?? [];
    expect(gates.length).toBe(2);
    expect(manageEventsPage).not.toMatch(/userProfile\?\.role === 'admin'/);
  });

  it('relies on the route for its own authorization', () => {
    // The page used to enforce the same rule twice more: a redirect effect that
    // fired a toast, and a `return null` that blanked the screen while it did.
    // An organizer saw a flash, an error, and a bounce. /events is gated in
    // App.tsx now, so there is nothing left to duplicate.
    expect(manageEventsPage).not.toContain('Only administrators can manage events');
    expect(manageEventsPage).not.toMatch(/role !== 'admin'/);
  });
});

describe('shared chart', () => {
  const chart = readFileSync('src/components/shared/UI/SimpleBarChart.tsx', 'utf-8');

  it('scrolls rather than shrinking below the legibility floor', () => {
    // Scaling a 600-unit viewBox into ~343px rendered 10px labels at ~6px.
    expect(chart).toContain('overflow-x-auto');
    expect(chart).toContain('min-w-[600px]');
  });

  it('exposes an accessible name and a stable-height empty state', () => {
    expect(chart).toContain('role="img"');
    expect(chart).toContain('aria-label={ariaLabel}');
    expect(chart).toContain('emptyMessage');
  });
});
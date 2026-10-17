/**
 * Contract tests for Home's pending-review CTA.
 *
 * The CTA advertises a count and deep-links into the event that owns the
 * backlog, filtered to ?status=pending. That is only honest if four things
 * stay true together:
 *
 *  1. the count is derived from resolveDisplayStatus, not a raw paymentStatus
 *     check (which under-counted and disagreed with the list),
 *  2. it is not truncated to a display-sized slice (the old .slice(0, 5)),
 *  3. it picks the event with the LARGEST backlog, not an arbitrary one,
 *  4. the attendees page actually honours ?status=.
 *
 * Structural assertions on the source, which is how the repo has always pinned
 * this pair. The click-through behaviour lives in tests/dom/homeStates.test.tsx,
 * where a real render can drive the button.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const adminHome = readFileSync(
  'src/pages/home/platform/PlatformHome.tsx',
  'utf-8'
);
const attendeesPage = readFileSync(
  'src/pages/events/workspace/tabs/AttendeesTab.tsx',
  'utf-8'
);

/** Drop comments so an explanatory note about a call can't satisfy a "not called" check. */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('Home pending count', () => {
  it('derives the count from the shared resolver, not a raw paymentStatus check', () => {
    expect(adminHome).toContain('countPendingRegistrations');
    // The old inline filter that disagreed with the attendees list.
    expect(adminHome).not.toMatch(/paymentStatus\s*===\s*'pending'/);
  });

  it('counts the whole roster rather than a top-N slice', () => {
    // A slice before counting capped the badge at 5 regardless of backlog.
    expect(adminHome).not.toMatch(/setPendingCount\([^)]*\.slice\(/);
  });

  it('has no reminder/snooze machinery left behind', () => {
    // Removed in the redesign: the count is permanently visible in the strip,
    // so a 2-hour "Remind Me Later" snooze added ceremony and no information.
    expect(adminHome).not.toContain('admin_pending_reminder');
    expect(adminHome).not.toContain('Remind Me Later');
    expect(adminHome).not.toContain('reminderDismissed');
  });

  it('has no card grid standing in for the action', () => {
    // DESIGN.md §1 rejects walls of identical cards, so the CTA is one button
    // in a tinted section rather than a tile among tiles.
    expect(adminHome).not.toContain('StatCard');
    expect(adminHome).not.toContain('QuickActionCard');
    expect(adminHome).not.toContain('AttendeeCard');
    expect(adminHome).not.toContain('Recent Events');
    expect(adminHome).not.toContain('Latest Pending Attendees');
    // The `actions` slot rendered the navbar Create Event button.
    expect(adminHome).not.toMatch(/actions=\{/);
  });

  it('deep-links into the event holding the backlog, not the event list', () => {
    // The old button said "N registrations need review" and went to /events,
    // which is an event list that cannot sort itself by backlog. A count with
    // no useful destination is a report, not a task.
    expect(adminHome).toContain('/events/${backlog.eventId}/attendees?status=pending');
    // Grouping is a pure reduce over the registrations already in hand, so the
    // CTA costs no extra Firestore read.
    expect(adminHome).toContain('const byEvent = new Map<string, Registration[]>()');
  });

  it('renders the shared stat strip and schedule components', () => {
    expect(adminHome).toContain('StatStrip');
    expect(adminHome).toContain('UpcomingEventsList');
  });

  it('renders the upcoming events list without noisy trend charts', () => {
    expect(adminHome).toContain('<UpcomingEventsList');
    expect(adminHome).not.toContain('<TrendPanel');
  });

  it('puts the action before the totals', () => {
    const cta = adminHome.indexOf('aria-label="Pending registrations"');
    const strip = adminHome.indexOf('<StatStrip ');
    expect(cta).toBeGreaterThan(-1);
    expect(cta).toBeLessThan(strip);
  });

  it('never renders zeros when the load failed', () => {
    // A failed read used to fall through to the strip and render 0 registrations
    // and ₱0 revenue, which reads as a fact rather than a failure.
    expect(adminHome).toContain("setFailed(true)");
    expect(adminHome).toContain('if (failed)');
    expect(adminHome).toContain('Try again');
  });

  it('keeps the primitive effect deps the dedup test asserts on', () => {
    // currentUser and userProfile are fresh objects on every auth re-render, so
    // depending on them directly would re-fetch in a loop. canReadAll is the
    // boolean that replaced userProfile.role, and it changes only when the role
    // or isActive does. `reload` is the retry handle.
    expect(adminHome).toMatch(
      /fetchDashboardData\(\);[\s\S]*\[currentUser\?\.uid,\s*canReadAll,\s*reload\]/
    );
  });

  it('does not fetch the published-events list it no longer displays', () => {
    // getPublishedEvents existed only to populate "Recent Events".
    expect(adminHome).not.toContain('getPublishedEvents');
  });
});

describe('organizer Home', () => {
  const organizerHome = readFileSync(
    'src/pages/home/scoped/ScopedHome.tsx',
    'utf-8'
  );

  it('never calls the admin-only unscoped dashboard stats', () => {
    // getDashboardStats() runs unscoped reads over registrations and
    // certificates, which firestore.rules denies to organizers and which would
    // breach the Data Privacy Act 2012 even if the rules allowed it.
    const code = withoutComments(organizerHome);
    expect(code).not.toContain('getDashboardStats');
    expect(code).not.toContain('getAllRegistrations');
    expect(code).not.toContain('AnalyticsService');
  });

  it('reads only organizer-scoped data', () => {
    expect(organizerHome).toContain('getEventsByOrganizer');
    expect(organizerHome).toContain('getRegistrationsByOrganizer');
  });

  it('has no hardcoded growth percentages', () => {
    // These were literal strings presented as real month-over-month deltas.
    expect(organizerHome).not.toMatch(/'\+\d+%/);
    expect(organizerHome).not.toContain('from last month');
  });

  it('delegates event roster and check-in CTAs to UpcomingEventsList', () => {
    expect(organizerHome).toContain('UpcomingEventsList');
    const upcomingEventsSource = readFileSync(
      'src/pages/home/UpcomingEventsList.tsx',
      'utf-8'
    );
    expect(upcomingEventsSource).toContain('/events/${nextEvent.id}/attendees');
    expect(upcomingEventsSource).toContain('/events/${nextEvent.id}/check-in');
  });

  it('renders UpcomingEventsList and puts the action queue first when backlogged', () => {
    expect(organizerHome).toContain('<UpcomingEventsList');
    expect(organizerHome).not.toContain('<TrendPanel');
    expect(organizerHome).toContain('aria-label="Pending registrations"');
  });

  it('never renders zeros when the load failed', () => {
    expect(organizerHome).toContain('if (failed)');
    expect(organizerHome).toContain('Try again');
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

  it('drives the filter options from the shared list', () => {
    expect(attendeesPage).toMatch(
      /STATUS_FILTER_OPTIONS\.map\(\(opt\) =>/
    );
  });
});

describe('check-in event targeting', () => {
  const checkInPage = readFileSync('src/pages/events/workspace/tabs/CheckInTab.tsx', 'utf-8');

  it('targets the eventId the workspace supplies, not the first event', () => {
    // The tab is opened from /events/:eventId, so the event is named by the
    // route rather than by a query string. Landing on a different event at the
    // door is worse than no shortcut, so the prop still wins over eventList[0].
    expect(checkInPage).toMatch(/interface CheckInTabProps \{[\s\S]*eventId: string;/);
    expect(checkInPage).toMatch(/setCurrentEvent\(requested \?\? eventList\[0\] \?\? null\)/);
  });
});

describe('create event reachability', () => {
  const manageEventsPage = readFileSync(
    'src/pages/events/EventListPage.tsx',
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
  const chart = readFileSync('src/components/UI/SimpleBarChart.tsx', 'utf-8');

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
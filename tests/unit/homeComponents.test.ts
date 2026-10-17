/**
 * Render smoke tests for the shared dashboard components.
 *
 * The rest of tests/unit is logic and source-shape assertions; this file is the
 * only coverage that actually mounts the new components, which is what catches
 * the class of mistake source assertions cannot see — a bad prop, a crash in a
 * reduce, an element that never renders.
 *
 * Written with React.createElement rather than JSX because vitest.config.ts
 * only globs test files ending in `.test.ts`. Widening that glob to include
 * tsx is a repo-wide config change and out of scope here; if it ever happens,
 * this file can be converted to JSX for free.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import StatStrip from '../../src/pages/home/StatStrip';
import TrendPanel from '../../src/pages/home/TrendPanel';
import UpcomingEventsList from '../../src/pages/home/UpcomingEventsList';
import SimpleBarChart from '../../src/components/UI/SimpleBarChart';

const h = React.createElement;

const REGISTRATIONS = [
  {
    registrationDate: new Date('2026-10-03T02:00:00Z'),
    paymentStatus: 'paid',
    totalAmount: 500,
  },
  {
    registrationDate: new Date('2026-10-04T05:00:00Z'),
    paymentStatus: 'paid',
    totalAmount: 250,
  },
  {
    registrationDate: new Date('2026-10-04T06:00:00Z'),
    paymentStatus: 'pending',
    totalAmount: 999,
  },
];

describe('StatStrip', () => {
  it('renders a delta when one is supplied', () => {
    const html = renderToStaticMarkup(
      h(StatStrip, {
        ariaLabel: 'Platform totals',
        metrics: [{ label: 'Total registrations', value: '12', delta: 20 }],
      })
    );
    expect(html).toContain('Total registrations');
    expect(html).toContain('+20%');
  });

  it('renders a negative delta without pretending it is a gain', () => {
    const html = renderToStaticMarkup(
      h(StatStrip, {
        ariaLabel: 'Platform totals',
        metrics: [{ label: 'Registrations', value: '8', delta: -25 }],
      })
    );
    expect(html).toContain('-25%');
  });

  it('omits the delta entirely when it is null, showing no percentage', () => {
    // The regression guard: a null delta must render no "%" at all rather than
    // falling back to 0% or the old fabricated 100%.
    const html = renderToStaticMarkup(
      h(StatStrip, {
        ariaLabel: 'Platform totals',
        metrics: [{ label: 'Certificates issued', value: '0', delta: null }],
      })
    );
    expect(html).not.toContain('%');
    expect(html).toContain('Certificates issued');
  });

  it('falls back to the hint line when there is no delta', () => {
    const html = renderToStaticMarkup(
      h(StatStrip, {
        ariaLabel: 'Platform totals',
        metrics: [
          {
            label: 'Revenue collected',
            value: '1,000',
            delta: null,
            hint: 'from approved payments',
          },
        ],
      })
    );
    expect(html).toContain('from approved payments');
  });

  it('renders nothing for an empty metric list', () => {
    expect(
      renderToStaticMarkup(h(StatStrip, { ariaLabel: 'x', metrics: [] }))
    ).toBe('');
  });

  it('exposes an accessible label on the group', () => {
    const html = renderToStaticMarkup(
      h(StatStrip, {
        ariaLabel: 'Platform totals',
        metrics: [{ label: 'Registrations', value: '1' }],
      })
    );
    expect(html).toContain('aria-label="Platform totals"');
  });
});

describe('TrendPanel', () => {
  // Series and range are panel state now, reached through the header controls
  // rather than props, so the interactions that change them are asserted in
  // tests/dom/homeStates.test.tsx with a real click.
  it('offers both series and both ranges in its header', () => {
    const html = renderToStaticMarkup(h(TrendPanel, { registrations: REGISTRATIONS }));
    expect(html).toContain('Registrations');
    expect(html).toContain('Revenue');
    expect(html).toContain('30 days');
    expect(html).toContain('90 days');
  });

  it('renders the registrations series and its window total', () => {
    const html = renderToStaticMarkup(
      h(TrendPanel, {
        registrations: REGISTRATIONS,
      })
    );
    expect(html).toContain('Registrations trend');
    // 3 registrations, 2 of them paid. Revenue must not leak into the count.
    expect(html).toContain('3 over the last 30 days');
  });

  it('shows an empty-state message instead of a bare axis when there is no data', () => {
    const html = renderToStaticMarkup(
      h(TrendPanel, {
        registrations: [],
      })
    );
    expect(html).toContain('No registrations in the last 30 days');
    expect(html).not.toContain('<rect');
  });

  it('states the reporting timezone so the axis cannot be misread', () => {
    const html = renderToStaticMarkup(
      h(TrendPanel, {
        registrations: REGISTRATIONS,
      })
    );
    expect(html).toContain('Asia/Manila');
  });
});

describe('SimpleBarChart', () => {
  it('scrolls rather than shrinking below the legibility floor', () => {
    const html = renderToStaticMarkup(
      h(SimpleBarChart, {
        data: [{ label: 'Oct 3', value: 2 }],
        xKey: 'label',
        yKey: 'value',
        ariaLabel: 'Registrations over the last 30 days',
      })
    );
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('min-w-[600px]');
  });

  it('is exposed to assistive tech as a labelled image', () => {
    const html = renderToStaticMarkup(
      h(SimpleBarChart, {
        data: [{ label: 'Oct 3', value: 2 }],
        xKey: 'label',
        yKey: 'value',
        ariaLabel: 'Registrations over the last 30 days: 2 total',
      })
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Registrations over the last 30 days: 2 total"');
  });

  it('draws one bar per data point and a hover title for each', () => {
    const html = renderToStaticMarkup(
      h(SimpleBarChart, {
        data: [
          { label: 'Oct 3', value: 2 },
          { label: 'Oct 4', value: 5 },
        ],
        xKey: 'label',
        yKey: 'value',
        ariaLabel: 'Registrations',
      })
    );
    expect(html.match(/<rect/g)).toHaveLength(2);
    expect(html).toContain('Oct 3: 2');
  });

  it('renders the empty message with no bars and no NaN axis', () => {
    const html = renderToStaticMarkup(
      h(SimpleBarChart, {
        data: [{ label: 'Oct 3', value: 0 }],
        xKey: 'label',
        yKey: 'value',
        ariaLabel: 'Registrations',
        emptyMessage: 'No registrations in the last 30 days',
      })
    );
    expect(html).toContain('No registrations in the last 30 days');
    expect(html).not.toContain('<rect');
    expect(html).not.toContain('NaN');
  });

  it('scales the value axis to the data maximum', () => {
    const html = renderToStaticMarkup(
      h(SimpleBarChart, {
        data: [{ label: 'Oct 3', value: 8 }],
        xKey: 'label',
        yKey: 'value',
        ariaLabel: 'Registrations',
      })
    );
    // Ticks run 0..max, so 8 must appear as the top gridline label.
    expect(html).toContain('>8<');
  });
});

const MOCK_EVENTS = [
  {
    id: 'event-1',
    slug: 'gdg-devfest-2026',
    title: 'GDG DevFest Davao 2026',
    isPublished: true,
    startDate: new Date('2026-11-15T09:00:00Z'),
    endDate: new Date('2026-11-15T18:00:00Z'),
    currentAttendees: 120,
    venue: { type: 'in-person' as const, name: 'SMX Convention Center', city: 'Davao City' },
  },
  {
    id: 'event-2',
    slug: 'io-extended-2026',
    title: 'Google I/O Extended Davao',
    isPublished: true,
    startDate: new Date('2026-12-05T13:00:00Z'),
    endDate: new Date('2026-12-05T17:00:00Z'),
    currentAttendees: 45,
    venue: { type: 'online' as const },
  },
];

describe('UpcomingEventsList', () => {
  it('renders Next Up spotlight card with title and action buttons', () => {
    const html = renderToStaticMarkup(
      h(
        MemoryRouter,
        null,
        h(UpcomingEventsList, {
          events: MOCK_EVENTS as never,
          registrationCounts: { 'event-1': 150 },
          canViewAllEvents: true,
        })
      )
    );
    expect(html).toContain('Up Next');
    expect(html).toContain('GDG DevFest Davao 2026');
    expect(html).toContain('Check in');
    expect(html).toContain('View roster');
    expect(html).toContain('/events/event-1/check-in');
    expect(html).toContain('/events/event-1/attendees');
    expect(html).toContain('150 attendees registered');
  });

  it('renders subsequent upcoming events in later schedule list', () => {
    const html = renderToStaticMarkup(
      h(
        MemoryRouter,
        null,
        h(UpcomingEventsList, {
          events: MOCK_EVENTS as never,
          canViewAllEvents: true,
        })
      )
    );
    expect(html).toContain('Later Schedule (1)');
    expect(html).toContain('Google I/O Extended Davao');
    expect(html).toContain('/events/event-2/attendees');
    expect(html).toContain('All events');
  });

  it('renders empty state when no upcoming events are scheduled', () => {
    const html = renderToStaticMarkup(
      h(
        MemoryRouter,
        null,
        h(UpcomingEventsList, {
          events: [],
        })
      )
    );
    expect(html).toContain('No upcoming events');
    expect(html).toContain('No events have been scheduled yet.');
  });

  it('offers past events link when all scheduled events have concluded', () => {
    const pastEvents = [
      {
        id: 'past-1',
        slug: 'past-event',
        title: 'Past Event',
        isPublished: true,
        startDate: new Date('2020-01-01T00:00:00Z'),
        endDate: new Date('2020-01-01T02:00:00Z'),
        currentAttendees: 10,
        venue: { type: 'online' as const },
      },
    ];
    const html = renderToStaticMarkup(
      h(
        MemoryRouter,
        null,
        h(UpcomingEventsList, {
          events: pastEvents as never,
          canViewAllEvents: true,
        })
      )
    );
    expect(html).toContain('All scheduled events have already taken place.');
    expect(html).toContain('Browse past events');
    expect(html).toContain('/events');
  });
});
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { getTicketSalesWindowStatus, isTicketWindowOpen } from '../../src/utils/pricing';
import { EventService } from '../../src/services/eventService';
import TicketSelector from '../../src/pages/registration/components/TicketSelector';
import { TicketType } from '../../src/types';

describe('Ticket Sales Window (`validFrom` / `validUntil`) (R4)', () => {
  const now = new Date('2026-10-30T12:00:00Z');

  it('evaluates open, not_started, and ended boundaries (including exact deadline === now)', () => {
    // Unbounded ticket -> open
    expect(isTicketWindowOpen({}, now)).toBe(true);

    // Future validFrom -> closed (not_started)
    const futureStart = new Date('2026-10-30T12:00:01Z');
    const notStartedStatus = getTicketSalesWindowStatus({ validFrom: futureStart as any }, now);
    expect(notStartedStatus.isOpen).toBe(false);
    expect(notStartedStatus.reason).toBe('not_started');

    // Past validUntil -> closed (ended)
    const pastEnd = new Date('2026-10-30T11:59:59Z');
    const endedStatus = getTicketSalesWindowStatus({ validUntil: pastEnd as any }, now);
    expect(endedStatus.isOpen).toBe(false);
    expect(endedStatus.reason).toBe('ended');

    // Exact deadline === now -> closed (ended)
    const exactEnd = getTicketSalesWindowStatus({ validUntil: now as any }, now);
    expect(exactEnd.isOpen).toBe(false);
    expect(exactEnd.reason).toBe('ended');

    // Within [validFrom, validUntil) -> open
    const openWindow = getTicketSalesWindowStatus(
      {
        validFrom: new Date('2026-10-29T00:00:00Z') as any,
        validUntil: new Date('2026-10-31T00:00:00Z') as any,
      },
      now
    );
    expect(openWindow.isOpen).toBe(true);
    expect(openWindow.reason).toBeUndefined();
  });

  it('rejects validFrom > validUntil in EventService.validateEventDataLocal', () => {
    const validation = EventService.validateEventDataLocal(
      {
        title: 'DevFest Davao',
        description: 'Annual community conference',
        shortDescription: 'DevFest',
        startDate: '2026-11-20',
        startTime: '09:00',
        endDate: '2026-11-20',
        endTime: '17:00',
        timezone: 'Asia/Manila',
        venueType: 'offline',
        venueName: 'SMX Convention Center',
        venueAddress: 'Lanang',
        city: 'Davao City',
        speakers: [],
        ticketTypes: [
          {
            id: 'early',
            name: 'Early Bird',
            price: 300,
            currency: 'PHP',
            currentSold: 0,
            isActive: true,
            sortOrder: 0,
            validFrom: new Date('2026-11-15T00:00:00Z') as any,
            validUntil: new Date('2026-11-10T00:00:00Z') as any,
          },
        ],
        isPaid: true,
        ticketPrice: 300,
        currency: 'PHP',
        registrationForm: [],
        category: 'conference',
        tags: [],
        requirements: [],
      },
      true
    );

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain(
      'Ticket 1 (Early Bird): Sales start must be before sales deadline'
    );
  });

  it('renders disabled ticket cards with "Sales ended" and "Not yet on sale" copy in TicketSelector', () => {
    const pastDate = new Date(Date.now() - 86_400_000);
    const futureDate = new Date(Date.now() + 86_400_000);

    const tickets: TicketType[] = [
      {
        id: 'ended-tier',
        name: 'Early Bird Pass',
        price: 250,
        currency: 'PHP',
        maxQuantity: 100,
        currentSold: 10,
        isActive: true,
        sortOrder: 0,
        validUntil: pastDate as any,
      },
      {
        id: 'upcoming-tier',
        name: 'Late Release Pass',
        price: 500,
        currency: 'PHP',
        maxQuantity: 100,
        currentSold: 0,
        isActive: true,
        sortOrder: 1,
        validFrom: futureDate as any,
      },
      {
        id: 'open-tier',
        name: 'General Admission',
        price: 350,
        currency: 'PHP',
        maxQuantity: 50,
        currentSold: 5,
        isActive: true,
        sortOrder: 2,
        validUntil: futureDate as any,
      },
    ];

    render(React.createElement(TicketSelector, { ticketTypes: tickets, onSelectionChange: vi.fn() }));

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);

    // Early Bird Pass -> disabled + Sales ended
    expect(radios[0]).toBeDisabled();
    expect(screen.getByText(/Sales ended/i)).toBeInTheDocument();

    // Late Release Pass -> disabled + Not yet on sale
    expect(radios[1]).toBeDisabled();
    expect(screen.getByText(/Not yet on sale/i)).toBeInTheDocument();

    // General Admission -> enabled + shows remaining & Sales end date
    expect(radios[2]).not.toBeDisabled();
    expect(screen.getByText('(45 left)')).toBeInTheDocument();
    expect(screen.getByText(/^Sales end\s/i)).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TicketCard from '../../src/components/TicketCard';
import { splitAttendeeName } from '../../src/utils/passArtwork';

describe('TicketCard Component (src/components/TicketCard.tsx)', () => {
  const sampleEvent = {
    id: 'devfest-2025',
    title: 'DevFest 2025',
    startDate: new Date('2025-09-21T02:00:00.000Z'), // 10:00 AM Manila
    timezone: 'Asia/Manila',
    venue: {
      name: 'SMX Convention Center, SM Lanang',
      address: 'Lanang, Davao City',
      city: 'Davao City',
    },
    ticketTypes: [{ id: 'ticket-ga', name: 'General Admission' }],
  };

  const sampleRegistration = {
    id: 'reg_devfest_001',
    eventId: 'devfest-2025',
    ticketTypeId: 'ticket-ga',
    qrCode: 'REG-1730000000-xyz123-abc',
    userDetails: {
      name: 'Juan John Dela Cruz',
      firstName: 'Juan John',
      lastName: 'Dela Cruz',
      email: 'juan@example.com',
    },
  };

  describe('splitAttendeeName helper', () => {
    it('splits explicit firstName and lastName', () => {
      const split = splitAttendeeName({ firstName: 'Juan John', lastName: 'Dela Cruz' });
      expect(split.display).toBe('Juan John');
      expect(split.secondary).toBe('Dela Cruz');
    });

    it('splits four-token composite name with Philippine Dela prefix', () => {
      const split = splitAttendeeName('Juan John Dela Cruz');
      expect(split.display).toBe('Juan John');
      expect(split.secondary).toBe('Dela Cruz');
    });

    it('splits three-token name into first name and last name', () => {
      const split = splitAttendeeName('Maria Santos Cruz');
      expect(split.display).toBe('Maria Santos');
      expect(split.secondary).toBe('Cruz');
    });

    it('handles single token name with empty secondary line', () => {
      const split = splitAttendeeName('Cher');
      expect(split.display).toBe('Cher');
      expect(split.secondary).toBe('');
    });

    it('falls back to Attendee when missing or empty', () => {
      expect(splitAttendeeName(null).display).toBe('Attendee');
      expect(splitAttendeeName('').display).toBe('Attendee');
    });
  });

  describe('TicketCard visual rendering', () => {
    it('renders attendee name split, role, and venue', () => {
      render(<TicketCard registration={sampleRegistration} event={sampleEvent} />);

      expect(screen.getByText('Juan John')).toBeInTheDocument();
      expect(screen.getByText('Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Participant • DevFest 2025')).toBeInTheDocument();
      expect(screen.getByText(/SMX Convention Center, SM Lanang/)).toBeInTheDocument();
    });

    it('renders event local date/time in black footer in Asia/Manila format', () => {
      render(<TicketCard registration={sampleRegistration} event={sampleEvent} />);

      expect(screen.getByText('09/21/2025 10:00AM')).toBeInTheDocument();
      const logo = screen.getByAltText('GDG Davao');
      expect(logo).toBeInTheDocument();
    });

    it('renders accessible QR code SVG inside 148x148px overlaid tile', () => {
      render(<TicketCard registration={sampleRegistration} event={sampleEvent} />);

      const qrTile = screen.getByTestId('qr-tile');
      expect(qrTile).toBeInTheDocument();

      const qrImg = screen.getByRole('img', {
        name: /Entry QR code for DevFest 2025, 09\/21\/2025 10:00AM/i,
      });
      expect(qrImg).toBeInTheDocument();
    });

    it('falls back to branded surface on artwork load error', () => {
      render(<TicketCard registration={sampleRegistration} event={sampleEvent} />);

      const img = screen.getByRole('presentation', { hidden: true }) || screen.queryByRole('img', { name: '' });
      const imageEl = document.querySelector('img[loading="lazy"]');
      expect(imageEl).not.toBeNull();

      // Trigger image load error
      fireEvent.error(imageEl!);

      const fallback = screen.getByTestId('artwork-fallback');
      expect(fallback).toBeInTheDocument();
      expect(fallback).toHaveTextContent('TeamApo Pass');
      expect(fallback).toHaveTextContent('DevFest 2025');

      // QR tile remains in place
      expect(screen.getByTestId('qr-tile')).toBeInTheDocument();
    });

    it('renders loading skeleton when loading={true}', () => {
      render(<TicketCard loading={true} />);

      const skeletonCard = screen.getByLabelText('Loading event ticket');
      expect(skeletonCard).toBeInTheDocument();
      expect(skeletonCard).toHaveAttribute('aria-busy', 'true');
    });
  });
});

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

    it('renders the event banner in the artwork block when present', () => {
      render(
        <TicketCard
          registration={sampleRegistration}
          event={{ ...sampleEvent, bannerUrl: 'https://example.com/banner.jpg' }}
        />
      );

      const banner = document.querySelector('img[loading="lazy"]');
      expect(banner).not.toBeNull();
      expect(banner).toHaveAttribute('src', 'https://example.com/banner.jpg');
    });

    it('renders an empty surface when the event has no banner', () => {
      render(<TicketCard registration={sampleRegistration} event={sampleEvent} />);

      expect(document.querySelector('img[loading="lazy"]')).toBeNull();
      expect(screen.queryByTestId('artwork-fallback')).toBeNull();
      // QR tile still overlays the empty surface
      expect(screen.getByTestId('qr-tile')).toBeInTheDocument();
    });

    it('hides the banner image on load error, keeping the QR tile', () => {
      render(
        <TicketCard
          registration={sampleRegistration}
          event={{ ...sampleEvent, bannerUrl: 'https://example.com/broken.jpg' }}
        />
      );

      const imageEl = document.querySelector('img[loading="lazy"]');
      expect(imageEl).not.toBeNull();
      fireEvent.error(imageEl!);

      expect(document.querySelector('img[loading="lazy"]')).toBeNull();
      expect(screen.getByTestId('qr-tile')).toBeInTheDocument();
    });

    it('renders the GDG wordmark in the footer', () => {
      render(<TicketCard registration={sampleRegistration} event={sampleEvent} />);

      const logo = screen.getByAltText('GDG Davao');
      expect(logo).toHaveAttribute('src', 'https://assets.gdgdavao.org/gdg-wordmark-light.png');
    });

    it('renders loading skeleton when loading={true}', () => {
      render(<TicketCard loading={true} />);

      const skeletonCard = screen.getByLabelText('Loading event ticket');
      expect(skeletonCard).toBeInTheDocument();
      expect(skeletonCard).toHaveAttribute('aria-busy', 'true');
    });
  });
});

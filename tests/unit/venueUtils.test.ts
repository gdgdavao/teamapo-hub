import { describe, it, expect } from 'vitest';
import { formatEventLocation } from '../../src/utils/venueUtils';
import type { Venue, Event } from '../../src/types';

describe('formatEventLocation', () => {
  it('returns fallback when venue/event is null or undefined', () => {
    expect(formatEventLocation(null)).toBe('Venue TBD');
    expect(formatEventLocation(undefined)).toBe('Venue TBD');
    expect(formatEventLocation(undefined, { fallback: 'No Venue Set' })).toBe('No Venue Set');
  });

  it('returns fallback when venue has no location information', () => {
    expect(formatEventLocation({})).toBe('Venue TBD');
    expect(formatEventLocation({ venue: {} as any })).toBe('Venue TBD');
  });

  describe('Online events', () => {
    it('formats virtual event without platform', () => {
      const venue: Partial<Venue> = { type: 'online' };
      expect(formatEventLocation(venue)).toBe('Virtual Event');
      expect(formatEventLocation({ venue } as any)).toBe('Virtual Event');
    });

    it('formats virtual event with platform', () => {
      const venue: Partial<Venue> = {
        type: 'online',
        onlineDetails: { platform: 'Google Meet' }
      };
      expect(formatEventLocation(venue)).toBe('Virtual Event (Google Meet)');
    });
  });

  describe('Hybrid events', () => {
    it('formats hybrid event with venue name and city', () => {
      const venue: Partial<Venue> = {
        type: 'hybrid',
        name: 'The Pinnacle Hotel',
        city: 'Davao City'
      };
      expect(formatEventLocation(venue)).toBe('The Pinnacle Hotel, Davao City (Hybrid)');
    });

    it('formats hybrid event without venue details', () => {
      const venue: Partial<Venue> = { type: 'hybrid' };
      expect(formatEventLocation(venue)).toBe('Hybrid Event');
    });
  });

  describe('In-person (Offline) events', () => {
    it('formats venue name and city when city is not in name', () => {
      const venue: Partial<Venue> = {
        type: 'offline',
        name: 'Finster Auditorium',
        city: 'Davao City'
      };
      expect(formatEventLocation(venue)).toBe('Finster Auditorium, Davao City');
    });

    it('avoids duplicating city if name already contains the city', () => {
      const venue1: Partial<Venue> = {
        type: 'offline',
        name: 'Ateneo de Davao University, Davao City',
        city: 'Davao City'
      };
      expect(formatEventLocation(venue1)).toBe('Ateneo de Davao University, Davao City');

      const venue2: Partial<Venue> = {
        type: 'offline',
        name: 'SMX Convention Center, Davao City',
        city: 'Davao City'
      };
      expect(formatEventLocation(venue2)).toBe('SMX Convention Center, Davao City');
    });

    it('formats address and city when venue name is omitted', () => {
      const venue: Partial<Venue> = {
        type: 'offline',
        address: 'E. Jacinto St, Poblacion District',
        city: 'Davao City'
      };
      expect(formatEventLocation(venue)).toBe('E. Jacinto St, Poblacion District, Davao City');
    });

    it('formats only city if neither name nor address is provided', () => {
      const venue: Partial<Venue> = {
        type: 'offline',
        city: 'Davao City'
      };
      expect(formatEventLocation(venue)).toBe('Davao City');
    });

    it('supports includeAddress option for full location string', () => {
      const venue: Partial<Venue> = {
        type: 'offline',
        name: 'Finster Hall',
        address: 'Ateneo de Davao University, E. Jacinto St',
        city: 'Davao City'
      };
      expect(
        formatEventLocation(venue, { includeAddress: true })
      ).toBe('Finster Hall, Ateneo de Davao University, E. Jacinto St, Davao City');
    });

    it('supports includeCity: false', () => {
      const venue: Partial<Venue> = {
        type: 'offline',
        name: 'Finster Auditorium',
        city: 'Davao City'
      };
      expect(formatEventLocation(venue, { includeCity: false })).toBe('Finster Auditorium');
    });
  });

  describe('Legacy document support', () => {
    it('extracts top-level location / venueName / city from legacy documents', () => {
      const legacyDoc = {
        title: 'Legacy Event',
        venueName: 'Davao Convention Center',
        city: 'Davao City'
      };
      expect(formatEventLocation(legacyDoc)).toBe('Davao Convention Center, Davao City');
    });

    it('handles legacy location field string', () => {
      const legacyDoc = {
        title: 'Legacy Event',
        location: 'Matina Enclaves'
      };
      expect(formatEventLocation(legacyDoc)).toBe('Matina Enclaves');
    });
  });
});

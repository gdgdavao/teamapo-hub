import type { Venue, Event } from '../types';

export interface FormatLocationOptions {
  /** Include full address when available (default: false) */
  includeAddress?: boolean;
  /** Include city suffix if not already present in name/address (default: true) */
  includeCity?: boolean;
  /** Fallback string if venue is completely empty/undefined (default: 'Venue TBD') */
  fallback?: string;
}

/**
 * Pure utility to format event venue and location across the application.
 * Safely accepts an Event, Venue, or null/undefined, handling online,
 * hybrid, and in-person venues without duplicating city names.
 */
export function formatEventLocation(
  eventOrVenue?: Partial<Venue> | Partial<Event> | any | null,
  options: FormatLocationOptions = {}
): string {
  if (!eventOrVenue) {
    return options.fallback ?? 'Venue TBD';
  }

  const venue: Partial<Venue> =
    typeof eventOrVenue === 'object' && 'venue' in eventOrVenue && eventOrVenue.venue
      ? eventOrVenue.venue
      : eventOrVenue;

  const rawType = venue?.type || (eventOrVenue as any)?.venueType;
  const type = rawType ? String(rawType).toLowerCase() : 'offline';

  if (type === 'online') {
    const platform = venue?.onlineDetails?.platform || (eventOrVenue as any)?.onlineDetails?.platform;
    return platform ? `Virtual Event (${platform})` : 'Virtual Event';
  }

  const name = (venue?.name || (eventOrVenue as any)?.venueName || (eventOrVenue as any)?.location)?.trim();
  const address = (venue?.address || (eventOrVenue as any)?.venueAddress)?.trim();
  const city = (venue?.city || (eventOrVenue as any)?.city)?.trim();

  const includeCity = options.includeCity ?? true;
  const includeAddress = options.includeAddress ?? false;

  // Helper to check if a text already contains the city name (e.g. "Davao City")
  const containsCity = (text?: string): boolean => {
    if (!text || !city) return false;
    const lowerText = text.toLowerCase();
    const lowerCity = city.toLowerCase();
    return lowerText.includes(lowerCity);
  };

  const isHybrid = type === 'hybrid';
  const suffix = isHybrid ? ' (Hybrid)' : '';

  // Case 1: Detailed address requested
  if (includeAddress) {
    const parts: string[] = [];
    if (name) parts.push(name);
    if (address && (!name || !name.toLowerCase().includes(address.toLowerCase()))) {
      parts.push(address);
    }
    if (city && includeCity && !parts.some((p) => containsCity(p))) {
      parts.push(city);
    }
    if (parts.length > 0) {
      return `${parts.join(', ')}${suffix}`;
    }
  }

  // Case 2: Standard/Compact formatting
  if (name) {
    if (includeCity && city && !containsCity(name)) {
      return `${name}, ${city}${suffix}`;
    }
    return `${name}${suffix}`;
  }

  if (address) {
    if (includeCity && city && !containsCity(address)) {
      return `${address}, ${city}${suffix}`;
    }
    return `${address}${suffix}`;
  }

  if (city) {
    return `${city}${suffix}`;
  }

  if (isHybrid) {
    return 'Hybrid Event';
  }

  return options.fallback ?? 'Venue TBD';
}

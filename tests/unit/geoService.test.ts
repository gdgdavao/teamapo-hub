import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOpenStreetMapUrl, searchPlaces, reverseGeocode } from '../../src/services/geoService';

describe('geoService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getOpenStreetMapUrl', () => {
    it('generates coordinate-based OpenStreetMap URL when lat/lng are provided', () => {
      const url = getOpenStreetMapUrl({ lat: 7.0731, lng: 125.6128 });
      expect(url).toBe('https://www.openstreetmap.org/?mlat=7.0731&mlon=125.6128#map=16/7.0731/125.6128');
    });

    it('generates query-based search URL when coordinates are omitted', () => {
      const url = getOpenStreetMapUrl(undefined, 'SMX Convention Center, Lanang, Davao City');
      expect(url).toContain('https://www.openstreetmap.org/search?query=');
      expect(url).toContain('SMX');
    });

    it('falls back to default city center when both coordinates and query are empty', () => {
      const url = getOpenStreetMapUrl();
      expect(url).toContain('https://www.openstreetmap.org/?mlat=7.0731&mlon=125.6128');
    });
  });

  describe('searchPlaces', () => {
    it('returns empty array if query is empty or shorter than 2 characters', async () => {
      const resultsEmpty = await searchPlaces('');
      const resultsSingle = await searchPlaces('a');
      expect(resultsEmpty).toEqual([]);
      expect(resultsSingle).toEqual([]);
    });

    it('parses Nominatim fallback response correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            place_id: 12345,
            name: 'Ateneo de Davao University',
            display_name: 'Ateneo de Davao University, E. Jacinto St, Davao City',
            lat: '7.0712',
            lon: '125.6134',
            address: {
              city: 'Davao City',
            },
          },
        ],
      } as any);

      const results = await searchPlaces('Ateneo');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Ateneo de Davao University');
      expect(results[0].coordinates.lat).toBe(7.0712);
      expect(results[0].coordinates.lng).toBe(125.6134);
      expect(results[0].city).toBe('Davao City');
      expect(results[0].mapsUrl).toContain('https://www.openstreetmap.org/?mlat=7.0712');
    });

    it('handles fetch network failures gracefully by returning empty array', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const results = await searchPlaces('Davao');
      expect(results).toEqual([]);
    });
  });

  describe('reverseGeocode', () => {
    it('parses reverse geocoding result from Nominatim', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          place_id: 67890,
          name: 'Finster Hall',
          display_name: 'Finster Hall, Jacinto St, Davao City',
          lat: '7.0715',
          lon: '125.6130',
          address: {
            city: 'Davao City',
          },
        }),
      } as any);

      const result = await reverseGeocode(7.0715, 125.6130);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Finster Hall');
      expect(result?.city).toBe('Davao City');
      expect(result?.coordinates).toEqual({ lat: 7.0715, lng: 125.6130 });
    });

    it('returns null if reverse geocoding request fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Fetch failed'));
      const result = await reverseGeocode(7.0715, 125.6130);
      expect(result).toBeNull();
    });
  });
});

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface GeoPlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  city: string;
  coordinates: GeoCoordinates;
  mapsUrl?: string;
}

const DEFAULT_CITY = 'Davao City';
const DEFAULT_COORDINATES: GeoCoordinates = { lat: 7.0731, lng: 125.6128 }; // Davao City Center

/**
 * Builds an OpenStreetMap URL for coordinates or address search query.
 */
export function getOpenStreetMapUrl(coords?: GeoCoordinates, addressOrQuery?: string): string {
  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=16/${coords.lat}/${coords.lng}`;
  }
  if (addressOrQuery && addressOrQuery.trim()) {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(addressOrQuery.trim())}`;
  }
  return `https://www.openstreetmap.org/?mlat=${DEFAULT_COORDINATES.lat}&mlon=${DEFAULT_COORDINATES.lng}#map=14/${DEFAULT_COORDINATES.lat}/${DEFAULT_COORDINATES.lng}`;
}

/**
 * Builds a canonical Google Maps search/directions URL for coordinates or address query.
 * ponytail: keyless universal Google Maps URL — works across iOS/Android native apps and all desktop browsers.
 */
export function getGoogleMapsUrl(coords?: GeoCoordinates, addressOrQuery?: string): string {
  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }
  if (addressOrQuery && addressOrQuery.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOrQuery.trim())}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${DEFAULT_COORDINATES.lat},${DEFAULT_COORDINATES.lng}`;
}

/**
 * Builds a keyless Google Maps iframe embed URL for public venue previews.
 * ponytail: output=embed requires zero API key for open-source clones.
 */
export function getGoogleMapsEmbedUrl(coords?: GeoCoordinates, addressOrQuery?: string): string {
  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`;
  }
  if (addressOrQuery && addressOrQuery.trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(addressOrQuery.trim())}&z=16&output=embed`;
  }
  return `https://www.google.com/maps?q=${DEFAULT_COORDINATES.lat},${DEFAULT_COORDINATES.lng}&z=14&output=embed`;
}

/**
 * Resolves a public-facing Google Maps URL, automatically upgrading legacy OpenStreetMap URLs
 * while preserving custom non-OSM links if explicitly set.
 */
export function resolvePublicGoogleMapsUrl(
  existingMapsUrl?: string,
  coords?: GeoCoordinates,
  addressOrQuery?: string
): string {
  const trimmed = existingMapsUrl?.trim();
  if (trimmed && !trimmed.toLowerCase().includes('openstreetmap.org')) {
    return trimmed;
  }
  return getGoogleMapsUrl(coords, addressOrQuery);
}

/**
 * Searches venues/places using Geoapify Autocomplete API, with graceful
 * fallback to OpenStreetMap Nominatim and manual entry.
 */
export async function searchPlaces(query: string): Promise<GeoPlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const apiKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY as string | undefined;

  // 1. Try Geoapify Autocomplete API if API key is provided
  if (apiKey) {
    try {
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(trimmed)}&apiKey=${apiKey}&format=json`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results.map((item: any): GeoPlaceResult => {
            const lat = Number(item.lat);
            const lng = Number(item.lon);
            const name = item.name || item.address_line1 || item.formatted || trimmed;
            const formatted = item.formatted || [item.address_line1, item.address_line2].filter(Boolean).join(', ');
            const city = item.city || item.county || item.state || DEFAULT_CITY;

            return {
              placeId: String(item.place_id || `${lat}-${lng}`),
              name,
              formattedAddress: formatted,
              city,
              coordinates: { lat, lng },
              mapsUrl: getGoogleMapsUrl({ lat, lng }),
            };
          });
        }
      }
    } catch {
      // Graceful fallback to Nominatim
    }
  }

  // 2. Open-Source Fallback: OpenStreetMap Nominatim API (No API key required)
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: any): GeoPlaceResult => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const name = item.name || (item.display_name ? item.display_name.split(',')[0].trim() : trimmed);
          const formatted = item.display_name || trimmed;
          const city =
            item.address?.city ||
            item.address?.town ||
            item.address?.municipality ||
            item.address?.county ||
            DEFAULT_CITY;

          return {
            placeId: String(item.place_id || `${lat}-${lng}`),
            name,
            formattedAddress: formatted,
            city,
            coordinates: { lat, lng },
            mapsUrl: getGoogleMapsUrl({ lat, lng }),
          };
        });
      }
    }
  } catch {
    // If offline or blocked, fallback to empty list
  }

  return [];
}

/**
 * Reverse geocodes coordinates to a human-readable place / address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlaceResult | null> {
  const apiKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY as string | undefined;

  // 1. Try Geoapify Reverse Geocode
  if (apiKey) {
    try {
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${apiKey}&format=json`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const first = data.results?.[0];
        if (first) {
          const name = first.name || first.address_line1 || first.formatted;
          const formatted = first.formatted || [first.address_line1, first.address_line2].filter(Boolean).join(', ');
          const city = first.city || first.county || first.state || DEFAULT_CITY;

          return {
            placeId: String(first.place_id || `${lat}-${lng}`),
            name,
            formattedAddress: formatted,
            city,
            coordinates: { lat, lng },
            mapsUrl: getGoogleMapsUrl({ lat, lng }),
          };
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  // 2. Open-Source Fallback: OpenStreetMap Nominatim Reverse
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(nominatimUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const name = data.name || (data.display_name ? data.display_name.split(',')[0].trim() : 'Pinned Location');
        const formatted = data.display_name;
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.municipality ||
          data.address?.county ||
          DEFAULT_CITY;

        return {
          placeId: String(data.place_id || `${lat}-${lng}`),
          name,
          formattedAddress: formatted,
          city,
          coordinates: { lat, lng },
          mapsUrl: getGoogleMapsUrl({ lat, lng }),
        };
      }
    }
  } catch {
    // Return null
  }

  return null;
}

import React, { useState, useEffect, useRef, useId } from 'react';
import {
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Badge, LeafletMap } from '../../../components/UI';
import {
  searchPlaces,
  reverseGeocode,
  getOpenStreetMapUrl,
  GeoPlaceResult,
} from '../../../services/geoService';

export interface VenueLocationData {
  venueName?: string;
  venueAddress?: string;
  city: string;
  venueCoordinates?: {
    lat: number;
    lng: number;
  };
  venuePlaceId?: string;
  venueMapsUrl?: string;
}

interface VenueLocationPickerProps {
  value: VenueLocationData;
  onChange: (updated: VenueLocationData) => void;
  disabled?: boolean;
}

export const VenueLocationPicker: React.FC<VenueLocationPickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<GeoPlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);

  const searchInputId = useId();
  const venueNameId = useId();
  const cityId = useId();
  const addressId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const apiKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY as string | undefined;

  // Debounced search query
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaces(searchQuery);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener to dismiss suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPlace = (place: GeoPlaceResult) => {
    onChange({
      ...value,
      venueName: place.name || value.venueName,
      venueAddress: place.formattedAddress || value.venueAddress,
      city: place.city || value.city || 'Davao City',
      venueCoordinates: place.coordinates,
      venuePlaceId: place.placeId,
      venueMapsUrl: place.mapsUrl || getOpenStreetMapUrl(place.coordinates),
    });

    setSearchQuery(place.name || place.formattedAddress);
    setShowDropdown(false);
  };

  const handleMapLocationSelect = async (coords: { lat: number; lng: number }) => {
    const mapsUrl = getOpenStreetMapUrl(coords);

    // Immediately update coordinates
    const updated: VenueLocationData = {
      ...value,
      venueCoordinates: coords,
      venueMapsUrl: mapsUrl,
    };
    onChange(updated);

    // Optionally reverse geocode to suggest address if address is blank
    setIsReverseGeocoding(true);
    try {
      const geoResult = await reverseGeocode(coords.lat, coords.lng);
      if (geoResult) {
        onChange({
          ...updated,
          venueName: value.venueName || geoResult.name,
          venueAddress: geoResult.formattedAddress || value.venueAddress,
          city: geoResult.city || value.city,
          venuePlaceId: geoResult.placeId || value.venuePlaceId,
          venueMapsUrl: geoResult.mapsUrl || mapsUrl,
        });
      }
    } catch {
      // Keep selected coordinates intact
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleManualAddressChange = (field: keyof VenueLocationData, newVal: any) => {
    const updated = {
      ...value,
      [field]: newVal,
    };

    // Keep mapsUrl in sync when user edits fields manually
    if (field === 'venueName' || field === 'venueAddress' || field === 'city') {
      const name = field === 'venueName' ? newVal : value.venueName;
      const addr = field === 'venueAddress' ? newVal : value.venueAddress;
      const cty = field === 'city' ? newVal : value.city;
      const query = [name, addr, cty].filter(Boolean).join(', ');
      if (query.trim() && !value.venueCoordinates) {
        updated.venueMapsUrl = getOpenStreetMapUrl(undefined, query);
      }
    }

    onChange(updated);
  };

  const resolvedMapsUrl =
    value.venueMapsUrl ||
    getOpenStreetMapUrl(
      value.venueCoordinates,
      [value.venueName, value.venueAddress, value.city].filter(Boolean).join(', ')
    );

  return (
    <div className="space-y-4">
      {/* Geoapify / OpenStreetMap Autocomplete Search Bar */}
      <div className="relative" ref={dropdownRef}>
        <label
          htmlFor={searchInputId}
          className="block text-sm font-medium text-on-surface-variant mb-1.5"
        >
          Search Venue & Landmarks
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
            {isSearching ? (
              <div className="h-4 w-4 motion-essential animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <MagnifyingGlassIcon className="h-5 w-5 text-primary" aria-hidden="true" />
            )}
          </div>
          <input
            id={searchInputId}
            type="text"
            disabled={disabled}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            placeholder="Search venue (e.g. Ateneo de Davao, SMX Convention Center)"
            className="w-full pl-11 pr-4 min-h-control rounded-lg border border-outline-variant bg-white text-on-surface placeholder:text-on-surface-variant/70 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Autocomplete Dropdown List */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            <ul className="py-1" role="listbox">
              {suggestions.map((place) => (
                <li
                  key={place.placeId}
                  role="option"
                  aria-selected="false"
                  onClick={() => handleSelectPlace(place)}
                  className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-surface-container cursor-pointer transition-colors border-b border-outline-variant/40 last:border-b-0"
                >
                  <MapPinIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface truncate">{place.name}</p>
                    <p className="text-xs text-on-surface-variant truncate">{place.formattedAddress}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 text-xs text-on-surface-variant">
          <span>
            {apiKey ? (
              'Powered by Geoapify & Leaflet (OpenStreetMap)'
            ) : (
              <span className="flex items-center gap-1 text-on-surface-variant">
                <InformationCircleIcon className="h-4 w-4 shrink-0 text-outline" aria-hidden="true" />
                <span>Powered by Leaflet & OpenStreetMap (Open-source fallback active)</span>
              </span>
            )}
          </span>
          {resolvedMapsUrl && (
            <a
              href={resolvedMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:text-primary-hover font-medium underline underline-offset-2 transition-colors"
            >
              <span>View on OpenStreetMap</span>
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {/* Structured Venue Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={venueNameId}
            className="block text-sm font-medium text-on-surface-variant mb-1.5"
          >
            Venue / Building Name
          </label>
          <input
            id={venueNameId}
            type="text"
            disabled={disabled}
            value={value.venueName || ''}
            onChange={(e) => handleManualAddressChange('venueName', e.target.value)}
            className="w-full px-3.5 py-2.5 min-h-control border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface text-base bg-white disabled:opacity-60"
            placeholder="e.g. Ateneo de Davao University - Finster Hall"
          />
        </div>

        <div>
          <label
            htmlFor={cityId}
            className="block text-sm font-medium text-on-surface-variant mb-1.5"
          >
            City
          </label>
          <input
            id={cityId}
            type="text"
            disabled={disabled}
            value={value.city || ''}
            onChange={(e) => handleManualAddressChange('city', e.target.value)}
            className="w-full px-3.5 py-2.5 min-h-control border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface text-base bg-white disabled:opacity-60"
            placeholder="e.g. Davao City"
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor={addressId}
            className="block text-sm font-medium text-on-surface-variant mb-1.5"
          >
            Full Address (Street, District, Zip Code)
          </label>
          <input
            id={addressId}
            type="text"
            disabled={disabled}
            value={value.venueAddress || ''}
            onChange={(e) => handleManualAddressChange('venueAddress', e.target.value)}
            className="w-full px-3.5 py-2.5 min-h-control border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface text-base bg-white disabled:opacity-60"
            placeholder="e.g. E. Jacinto St, Poblacion District, Davao City, 8000 Davao del Sur"
          />
        </div>
      </div>

      {/* Interactive Leaflet Map & Venue Location Badge */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold text-on-surface">
                {value.venueName || 'Venue Map Location'}
              </div>
              <div className="text-xs text-on-surface-variant">
                {isReverseGeocoding ? (
                  <span className="italic">Resolving location details…</span>
                ) : (
                  value.venueAddress || `${value.city || 'Davao City'}`
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {value.venueCoordinates && (
              <Badge tone="neutral">
                {value.venueCoordinates.lat.toFixed(4)}, {value.venueCoordinates.lng.toFixed(4)}
              </Badge>
            )}
            {resolvedMapsUrl && (
              <a
                href={resolvedMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-container hover:text-primary-hover transition-colors"
              >
                <span>Open in OpenStreetMap</span>
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {/* Interactive Leaflet Map View */}
        <div className="overflow-hidden rounded-lg border border-outline-variant">
          <LeafletMap
            interactive={!disabled}
            coordinates={value.venueCoordinates}
            venueName={value.venueName}
            venueAddress={value.venueAddress}
            onLocationSelect={handleMapLocationSelect}
            height="220px"
          />
        </div>

        <p className="text-xs text-on-surface-variant flex items-center gap-1">
          <CheckIcon className="h-3.5 w-3.5 text-success shrink-0" aria-hidden="true" />
          <span>Tip: You can click anywhere on the map or drag the pin to adjust the exact event entrance.</span>
        </p>
      </div>
    </div>
  );
};

export default VenueLocationPicker;

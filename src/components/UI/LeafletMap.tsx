import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

export interface LeafletMapProps {
  coordinates?: {
    lat: number;
    lng: number;
  };
  venueName?: string;
  venueAddress?: string;
  interactive?: boolean;
  onLocationSelect?: (coords: { lat: number; lng: number }) => void;
  className?: string;
  zoom?: number;
  height?: string;
}

const DEFAULT_COORDINATES = { lat: 7.0731, lng: 125.6128 }; // Davao City Center

export const LeafletMap: React.FC<LeafletMapProps> = ({
  coordinates,
  venueName,
  venueAddress,
  interactive = false,
  onLocationSelect,
  className = '',
  zoom = 15,
  height = '240px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const activeCoords = coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number'
    ? coordinates
    : DEFAULT_COORDINATES;

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      try {
        const L = (await import('leaflet')).default || (await import('leaflet'));

        if (!isMounted || !containerRef.current) return;

        // Create M3-styled vector marker icon
        const customMarkerIcon = L.divIcon({
          className: 'apohub-leaflet-marker',
          html: `
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background-color: #0b57d0;
              color: #ffffff;
              border: 2px solid #ffffff;
              box-shadow: 0 4px 12px rgba(11, 87, 208, 0.45);
              cursor: ${interactive ? 'grab' : 'pointer'};
              transform: translate(-50%, -50%);
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" fill="currentColor" />
              </svg>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        });

        const map = L.map(containerRef.current, {
          center: [activeCoords.lat, activeCoords.lng],
          zoom,
          scrollWheelZoom: false,
          zoomControl: true,
        });

        const apiKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY as string | undefined;

        // Select tile layer: Geoapify OSM-Bright if key is configured, standard OpenStreetMap otherwise
        const tileUrl = apiKey
          ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${apiKey}`
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        const tileAttribution = apiKey
          ? 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

        L.tileLayer(tileUrl, {
          maxZoom: 19,
          attribution: tileAttribution,
        }).addTo(map);

        // Place marker
        const marker = L.marker([activeCoords.lat, activeCoords.lng], {
          icon: customMarkerIcon,
          draggable: interactive,
          title: venueName || 'Venue Location',
        }).addTo(map);

        if (venueName || venueAddress) {
          marker.bindPopup(`
            <div style="font-family: inherit; padding: 2px 4px;">
              <strong style="display: block; font-size: 13px; color: #1f1f1f; margin-bottom: 2px;">${venueName || 'Event Venue'}</strong>
              <span style="font-size: 11px; color: #444746;">${venueAddress || ''}</span>
            </div>
          `);
        }

        if (interactive) {
          // Allow clicking on map to reposition marker
          map.on('click', (e: any) => {
            const newCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
            marker.setLatLng([newCoords.lat, newCoords.lng]);
            if (onLocationSelect) {
              onLocationSelect(newCoords);
            }
          });

          // Allow dragging marker
          marker.on('dragend', () => {
            const latLng = marker.getLatLng();
            const newCoords = { lat: latLng.lat, lng: latLng.lng };
            if (onLocationSelect) {
              onLocationSelect(newCoords);
            }
          });
        }

        mapRef.current = map;
        markerRef.current = marker;
        setMapReady(true);

        // Invalidate size after layout settles
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 150);
      } catch {
        // Fallback gracefully without breaking React tree
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Sync coordinates when updated externally (e.g. autocomplete selection)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !coordinates) return;

    try {
      const latLng: [number, number] = [coordinates.lat, coordinates.lng];
      markerRef.current.setLatLng(latLng);
      mapRef.current.setView(latLng, zoom, { animate: true });
    } catch {
      // Ignore
    }
  }, [coordinates?.lat, coordinates?.lng, zoom]);

  // Sync popup content
  useEffect(() => {
    if (!markerRef.current) return;
    if (venueName || venueAddress) {
      markerRef.current.setPopupContent(`
        <div style="font-family: inherit; padding: 2px 4px;">
          <strong style="display: block; font-size: 13px; color: #1f1f1f; margin-bottom: 2px;">${venueName || 'Event Venue'}</strong>
          <span style="font-size: 11px; color: #444746;">${venueAddress || ''}</span>
        </div>
      `);
    }
  }, [venueName, venueAddress]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-outline-variant bg-surface-container ${className}`}
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="w-full h-full z-0"
        aria-label={venueName ? `Map of ${venueName}` : 'Venue location map'}
      />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container text-xs text-on-surface-variant">
          Loading map…
        </div>
      )}
    </div>
  );
};

export default LeafletMap;

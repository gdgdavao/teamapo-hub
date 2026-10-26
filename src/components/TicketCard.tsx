import React, { useState, useId } from 'react';
import { Skeleton } from './UI';
import { GDG_LOGO_URL } from '../config/app';
import { getArtworkUrl, splitAttendeeName } from '../utils/passArtwork';
import { formatTicketDate } from '../utils/dateUtils';
import { generateQrVector } from '../utils/qrCode';

export interface TicketCardAttendee {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface TicketCardRegistration {
  id: string;
  eventId?: string;
  ticketTypeId?: string;
  ticketType?: { name?: string } | string;
  qrCode?: string;
  registrationStatus?: string;
  paymentStatus?: string;
  userDetails?: TicketCardAttendee;
  attendeeName?: string;
}

export interface TicketCardVenue {
  type?: 'online' | 'offline' | 'hybrid';
  name?: string;
  address?: string;
  city?: string;
}

export interface TicketCardEvent {
  id: string;
  title: string;
  startDate?: unknown;
  endDate?: unknown;
  timezone?: string;
  venue?: TicketCardVenue | string;
  locationTba?: boolean;
  ticketTypes?: Array<{ id: string; name: string }>;
}

export interface TicketCardProps {
  registration?: TicketCardRegistration | null;
  event?: TicketCardEvent | null;
  loading?: boolean;
  className?: string;
}

/**
 * Resolves participant role line e.g. "Participant • DevFest 2025"
 */
function resolveRoleLine(
  registration?: TicketCardRegistration | null,
  event?: TicketCardEvent | null
): string {
  let role = 'Participant';

  if (registration?.ticketType) {
    if (typeof registration.ticketType === 'string') {
      role = registration.ticketType;
    } else if (registration.ticketType.name) {
      role = registration.ticketType.name;
    }
  } else if (registration?.ticketTypeId && event?.ticketTypes) {
    const matched = event.ticketTypes.find((t) => t.id === registration.ticketTypeId);
    if (matched?.name) {
      role = matched.name;
    }
  }

  // Normalize generic names like "General Admission" to "Participant" for badge mock alignment
  if (role.toLowerCase() === 'general admission' || role.toLowerCase() === 'standard') {
    role = 'Participant';
  }

  const eventTitle = event?.title || 'GDG Davao Event';
  return `${role} • ${eventTitle}`;
}

/**
 * Formats venue string for the ticket card meta rows.
 */
function resolveVenueLine(event?: TicketCardEvent | null): string {
  if (!event) return 'Davao City, Philippines';
  if (event.locationTba) return 'Location TBA';

  const venue = event.venue;
  if (!venue) return 'Davao City, Philippines';

  if (typeof venue === 'string') {
    return venue;
  }

  if (venue.type === 'online') {
    return 'Online Event';
  }

  const parts: string[] = [];
  if (venue.name?.trim()) parts.push(venue.name.trim());
  if (venue.address?.trim() && venue.address.trim() !== venue.name?.trim()) {
    parts.push(venue.address.trim());
  }
  if (venue.city?.trim() && !parts.some((p) => p.includes(venue.city!.trim()))) {
    parts.push(venue.city.trim());
  }

  return parts.length > 0 ? parts.join(', ') : 'Davao City, Philippines';
}

/**
 * Canonical In-App Ticket Card Credential Component (TeamApo Hub)
 * Implements the approved Davao painting mock specified in docs/PassUI.md.
 */
export const TicketCard: React.FC<TicketCardProps> = ({
  registration,
  event,
  loading = false,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const reactId = useId().replace(/[:]/g, '_');
  const gradientId = `qr-ticket-grad-${reactId}`;

  // Loading skeleton state per docs/PassUI.md §4
  if (loading || (!registration && !event)) {
    return (
      <div
        className={`w-full max-w-[26.25rem] mx-auto bg-surface rounded-[16px] overflow-hidden border border-outline-variant/60 shadow-lg ${className}`}
        aria-busy="true"
        aria-label="Loading event ticket"
      >
        {/* Header Skeleton */}
        <div className="p-6 space-y-3">
          <Skeleton className="h-10 w-3/4 rounded-lg" />
          <Skeleton className="h-7 w-1/2 rounded-lg" />
          <Skeleton className="h-4 w-5/6 rounded mt-4" />
          <Skeleton className="h-4 w-2/3 rounded mt-1" />
        </div>

        {/* Artwork Skeleton */}
        <div className="w-full aspect-[5/3] relative bg-surface-container-high">
          <div className="absolute bottom-4 right-4 w-[148px] h-[148px] rounded-2xl bg-surface p-3 shadow-md flex items-center justify-center">
            <Skeleton className="w-[124px] h-[124px] rounded-lg" />
          </div>
        </div>

        {/* Footer Skeleton */}
        <div className="min-h-[56px] px-6 py-3 bg-black flex items-center justify-between">
          <Skeleton className="h-6 w-24 bg-white/20 rounded" />
          <Skeleton className="h-5 w-32 bg-white/20 rounded" />
        </div>
      </div>
    );
  }

  const regId = registration?.id || '';
  const artworkUrl = getArtworkUrl(regId);
  const { display: firstNameDisplay, secondary: lastNameSecondary } = splitAttendeeName(
    registration?.userDetails || registration?.attendeeName
  );

  const roleLine = resolveRoleLine(registration, event);
  const venueLine = resolveVenueLine(event);
  const eventDateFormatted = formatTicketDate(
    event?.startDate,
    event?.timezone || 'Asia/Manila'
  );

  const qrCodeValue = registration?.qrCode || (regId ? `registration:${regId}` : 'GDG-DAVAO-TICKET');
  const qrAriaLabel = `Entry QR code for ${event?.title || 'event'}, ${eventDateFormatted}`;

  const { totalSize, path: qrPath } = generateQrVector(qrCodeValue, { quietZone: 2 });

  return (
    <article
      className={`w-full max-w-[26.25rem] mx-auto bg-surface rounded-[16px] overflow-hidden border border-outline-variant/60 shadow-lg text-left select-text ${className}`}
      aria-label={`Event ticket for ${firstNameDisplay} ${lastNameSecondary}`}
    >
      {/* 1. Header Block: Identity Hierarchy & Metadata */}
      <header className="p-6">
        <h1
          className="font-google font-bold text-on-surface truncate tracking-[-0.02em] leading-none"
          style={{ fontSize: 'clamp(2.5rem, 11vw, 3.25rem)' }}
          title={firstNameDisplay}
        >
          {firstNameDisplay}
        </h1>

        {lastNameSecondary ? (
          <p
            className="font-google font-normal text-[1.75rem] leading-[1.2] text-on-surface truncate mt-1"
            title={lastNameSecondary}
          >
            {lastNameSecondary}
          </p>
        ) : null}

        <div className="mt-2 space-y-1">
          <p
            className="font-google font-medium text-sm sm:text-base text-on-surface-variant truncate"
            title={roleLine}
          >
            {roleLine}
          </p>
          <p
            className="font-google font-normal text-sm sm:text-base text-on-surface-variant line-clamp-2"
            title={venueLine}
          >
            {venueLine}
          </p>
        </div>
      </header>

      {/* 2. Artwork Block (5:3 Ratio) with Overlaid QR Tile */}
      <div className="relative w-full aspect-[5/3] overflow-hidden bg-primary/10">
        {!imageError && artworkUrl ? (
          <img
            src={artworkUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          /* Branded plain surface fallback on load error per docs/PassUI.md §3.3 */
          <div
            data-testid="artwork-fallback"
            className="w-full h-full bg-[#0b57d0] flex flex-col justify-end p-6 text-white/90"
          >
            <div className="max-w-[55%] space-y-1">
              <span className="text-xs uppercase font-semibold tracking-wider text-white/70">
                TeamApo Pass
              </span>
              <p className="text-sm font-medium line-clamp-2 text-white">
                {event?.title || 'GDG Davao'}
              </p>
            </div>
          </div>
        )}

        {/* 148×148px Overlaid White QR Tile anchored bottom-right */}
        <div
          data-testid="qr-tile"
          className="absolute bottom-4 right-4 w-[148px] h-[148px] bg-white rounded-2xl p-3 shadow-md flex items-center justify-center z-10"
        >
          <svg
            viewBox={`0 0 ${totalSize} ${totalSize}`}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={qrAriaLabel}
            className="w-[124px] h-[124px] max-w-full max-h-full"
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0b57d0" />
                <stop offset="100%" stopColor="#0f9d58" />
              </linearGradient>
            </defs>
            <path d={qrPath} fill={`url(#${gradientId})`} shapeRendering="crispEdges" />
          </svg>
        </div>
      </div>

      {/* 3. Black Footer Bar (~56px height) */}
      <footer className="min-h-[56px] px-6 py-3 bg-black flex items-center justify-between text-white select-none gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={GDG_LOGO_URL}
            alt="GDG Davao"
            className="h-6 w-auto max-w-[140px] sm:max-w-[180px] object-contain shrink-0"
          />
        </div>

        <div className="shrink-0 text-right">
          <span className="font-mono text-xs sm:text-sm text-white tracking-[0.02em] whitespace-nowrap">
            {eventDateFormatted}
          </span>
        </div>
      </footer>
    </article>
  );
};

export default TicketCard;

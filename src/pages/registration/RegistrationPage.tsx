import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  MapPinIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShareIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { EventService } from '../../services/eventService';
import { getGoogleMapsEmbedUrl, resolvePublicGoogleMapsUrl } from '../../services/geoService';
import RegistrationModal from './components/RegistrationModal';
import Reveal from './components/Reveal';
import { Event, FormField } from '../../types';
import toast from 'react-hot-toast';
import usePageTitle from '../../hooks/usePageTitle';
import useSEO from '../../hooks/useSEO';
import { getDownloadUrlFromPath } from '../../utils/storageUtils';
import { logger } from '../../utils/logger';
import { toDateSafe } from '../../utils/dateUtils';
import { formatEventLocation } from '../../utils/venueUtils';
import { useAuth } from '../../contexts/AuthContext';

interface EventRegistrationPageProps {
  isPreview?: boolean;
}

const EventRegistrationPage: React.FC<EventRegistrationPageProps> = ({ isPreview = false }) => {
  const { eventId, slug } = useParams<{ eventId?: string; slug?: string }>();
  const location = useLocation();
  const { loading: authLoading, currentUser } = useAuth();
  const effectiveIsPreview = isPreview || location.pathname.endsWith('/preview');
  
  const [event, setEvent] = useState<Event | null>(null);
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] = useState<FormField[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [metaImageUrl, setMetaImageUrl] = useState<string>('https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png');
  const [imageResolved, setImageResolved] = useState(false);
  const hasLoadedFormRef = useRef(false);
  const hasInitialDataRef = useRef(false);

  // Set page title
  usePageTitle();

  // Resolve public URL for social sharing image when event changes
  useEffect(() => {
    const resolveImage = async () => {
      logger.log('[Image Resolution] Starting...', {
        hasEvent: !!event,
        eventImageUrl: event?.imageUrl,
        eventBannerUrl: event?.bannerUrl
      });

      if (!event) {
        logger.log('[Image Resolution] No event, using default banner');
        setMetaImageUrl('https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png');
        setImageResolved(true);
        return;
      }

      const raw = event.imageUrl || event.bannerUrl;
      if (!raw) {
        logger.log('[Image Resolution] No image URL in event, using default banner');
        setMetaImageUrl('https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png');
        setImageResolved(true);
        return;
      }

      // If already an absolute URL, use it; otherwise resolve from storage path
      if (/^https?:\/\//i.test(raw)) {
        logger.log('[Image Resolution] Using absolute URL', { url: raw });
        setMetaImageUrl(raw);
        setImageResolved(true);
        return;
      }

      // This is a Firebase Storage path, resolve it to a public URL
      logger.log('[Image Resolution] Resolving Firebase Storage path', { path: raw });
      try {
        const url = await getDownloadUrlFromPath(raw);
        if (url) {
          logger.log('[Image Resolution] Successfully resolved Firebase Storage URL', { url });
          setMetaImageUrl(url);
        } else {
          logger.warn('[Image Resolution] Failed to resolve, using default banner');
          setMetaImageUrl('https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png');
        }
        setImageResolved(true);
      } catch (error) {
        logger.error('[Image Resolution] Error resolving Firebase Storage URL', error);
        setMetaImageUrl('https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png');
        setImageResolved(true);
      }
    };
    resolveImage();
  }, [event]);

  // Set up SEO with resolved event image - only update when image is resolved and event is loaded
  // This ensures the event's Firebase Storage image is used instead of the default banner
  useEffect(() => {
    // Only set SEO meta tags after image resolution is complete
    if (!imageResolved) return;

    logger.log('[SEO Update] Setting meta tags with resolved image', {
      eventTitle: event?.title,
      metaImageUrl,
      isEventImage: metaImageUrl !== 'https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png'
    });
  }, [imageResolved, event, metaImageUrl]);

  useSEO({
    title: event ? `${event.title} | Google Developer Groups - Davao` : 'Event Registration | Google Developer Groups - Davao',
    description: event ? (event.shortDescription || event.description) : 'Join our upcoming event',
    ogImage: metaImageUrl,
    ogImageAlt: event ? `${event.title} Event Banner` : 'GDG Davao Community Banner',
    ogImageWidth: '1200',
    ogImageHeight: '630',
    ogType: 'event',
    structuredData: event ? {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.title,
      description: event.shortDescription || event.description,
      image: metaImageUrl,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.venue.type === 'online' 
        ? {
            '@type': 'VirtualLocation',
            url: event.venue.onlineDetails?.meetingUrl
          }
        : {
            '@type': 'Place',
            name: event.venue.name,
            address: event.venue.address,
            addressLocality: event.venue.city
          },
      organizer: {
        '@type': 'Organization',
        name: event.organizer?.name || 'GDG Davao',
        email: event.organizer?.email || 'davao@gdg.org.ph'
      },
      offers: event.ticketTypes?.map(ticket => ({
        '@type': 'Offer',
        name: ticket.name,
        price: ticket.price,
        priceCurrency: ticket.currency,
        availability: ticket.isActive ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
      }))
    } : undefined
  });

  // Resolve slug to eventId if needed
  useEffect(() => {
    const resolveEventIdentifier = async () => {
      if (eventId) {
        setResolvedEventId(eventId);
        EventService.getEvent(eventId).then((cachedEvent) => {
          if (cachedEvent && !effectiveIsPreview && cachedEvent.status === 'published' && cachedEvent.isPublished) {
            hasInitialDataRef.current = true;
            setEvent(cachedEvent);
            if (cachedEvent.registrationForm?.length) {
              setRegistrationForm(cachedEvent.registrationForm);
              hasLoadedFormRef.current = true;
            }
            setLoading(false);
          }
        });
        return;
      }
      
      if (slug) {
        try {
          const eventBySlug = await EventService.getEventBySlug(slug);
          if (eventBySlug) {
            setResolvedEventId(eventBySlug.id);
            if (!effectiveIsPreview && eventBySlug.status === 'published' && eventBySlug.isPublished) {
              hasInitialDataRef.current = true;
              setEvent(eventBySlug);
              if (eventBySlug.registrationForm?.length) {
                setRegistrationForm(eventBySlug.registrationForm);
                hasLoadedFormRef.current = true;
              }
              setLoading(false);
            }
            return;
          }

          // Fallback: If slug matches an event document ID directly (e.g. /e/event-003 or legacy forward)
          const eventById = await EventService.getEvent(slug);
          if (eventById) {
            setResolvedEventId(eventById.id);
            if (!effectiveIsPreview && eventById.status === 'published' && eventById.isPublished) {
              hasInitialDataRef.current = true;
              setEvent(eventById);
              if (eventById.registrationForm?.length) {
                setRegistrationForm(eventById.registrationForm);
                hasLoadedFormRef.current = true;
              }
              setLoading(false);
            }
            return;
          }

          setError('Event not found');
          setLoading(false);
        } catch (err) {
          logger.error('Error resolving event slug:', err);
          setError('Failed to load event');
          setLoading(false);
        }
        return;
      }
      
      setError('Event ID or slug is required');
      setLoading(false);
    };
    
    resolveEventIdentifier();
  }, [eventId, slug, effectiveIsPreview]);

  // Load event data with real-time updates
  useEffect(() => {
    if (!resolvedEventId) {
      return;
    }

    // In preview mode, wait for auth to finish hydrating so draft/unpublished events
    // can be loaded with the authenticated organizer's credentials
    if (effectiveIsPreview && authLoading) {
      return;
    }

    // Only trigger full loading spinner if no event data is available in state or cache
    if (!hasInitialDataRef.current) {
      setLoading(true);
    }

    const unsubscribe = EventService.subscribeToEvent(
      resolvedEventId,
      eventData => {
        if (!eventData) {
          setError('Event not found');
          setEvent(null);
          setRegistrationForm([]);
          hasLoadedFormRef.current = false;
          setLoading(false);
          return;
        }

        if (!effectiveIsPreview && (eventData.status !== 'published' || !eventData.isPublished)) {
          setError('This event is not yet published');
          setEvent(null);
          setRegistrationForm([]);
          hasLoadedFormRef.current = false;
          setLoading(false);
          return;
        }

        setError(null);
        setEvent(eventData);
        if (eventData.registrationForm?.length) {
          setRegistrationForm(eventData.registrationForm);
          hasLoadedFormRef.current = true;
        }
        setLoading(false);
      },
      err => {
        logger.error('Error loading event:', err);
        if (effectiveIsPreview && !currentUser) {
          setError('This event is unpublished. Please sign in to preview draft events.');
        } else {
          setError('Failed to load event details');
        }
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [resolvedEventId, effectiveIsPreview, authLoading, currentUser]);

  useEffect(() => {
    hasLoadedFormRef.current = false;
    hasInitialDataRef.current = false;
  }, [resolvedEventId]);

  // Load registration form configuration once event is available
  useEffect(() => {
    if (!resolvedEventId || !event || hasLoadedFormRef.current) {
      return;
    }

    // If event already carries the registrationForm in its document, use it immediately
    if (event.registrationForm && event.registrationForm.length > 0) {
      setRegistrationForm(event.registrationForm);
      hasLoadedFormRef.current = true;
      return;
    }

    const loadRegistrationForm = async () => {
      try {
        const formFields = await EventService.getEventRegistrationForm(resolvedEventId);
        setRegistrationForm(formFields);
        hasLoadedFormRef.current = true;
      } catch (err) {
        logger.error('Error loading registration form:', err);
        toast.error('Failed to load registration form. Please refresh the page.');
      }
    };

    loadRegistrationForm();
  }, [resolvedEventId, event]);

  const copyEventLink = async () => {
    const identifier = event?.slug || resolvedEventId;
    if (!identifier) return;

    const url = `${window.location.origin}/e/${identifier}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Event link copied to clipboard.');
    } catch (err) {
      logger.error('Failed to copy event link:', err);
      toast.error('Failed to copy event link. Please try again.');
    }
  };

  const openRegistrationModal = () => {
    setIsModalOpen(true);
  };

  const closeRegistrationModal = () => {
    setIsModalOpen(false);
  };

  const toJSDate = (value: any): Date | null => {
    return toDateSafe(value);
  };

  const formatDate = (date: any) => {
    const d = toJSDate(date);
    if (!d) return 'TBD';
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: any) => {
    const d = toJSDate(date);
    if (!d) return 'TBD';
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-page bg-surface-container-low">
        <div className="h-72 sm:h-96 bg-inverse-surface" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          <div className="h-5 w-28 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
          <div className="h-10 w-3/4 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
          <div className="h-5 w-full rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
          <div className="h-5 w-2/3 rounded bg-surface-container animate-pulse motion-reduce:animate-none" />
          <div className="h-32 w-full rounded-xl border border-outline-variant bg-surface" />
        </div>
        <span className="sr-only" role="status">Loading event details</span>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-page bg-surface-container-low flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <ExclamationTriangleIcon className="w-14 h-14 text-warning mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-on-surface mb-2">Event not found</h1>
          <p className="text-on-surface-variant break-words">{error || 'This event does not exist, or it is no longer published.'}</p>
          {effectiveIsPreview && resolvedEventId && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={`/events/${resolvedEventId}`}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Return to Workspace
              </Link>
              {!currentUser && (
                <Link
                  to={`/auth/login?from=${encodeURIComponent(location.pathname)}`}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-outline-variant bg-white px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Sign In
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Check if registration is closed
  const isRegistrationClosed = event.registrationStatus === 'closed';
  const activeTicketTypes = event.ticketTypes?.filter(ticket => ticket.isActive !== false) || [];
  const hasPaidTicketOptions = activeTicketTypes.some(ticket => ticket.price > 0);

  // The SEO block above already falls back to bannerUrl; the visible hero has to
  // agree with it. Previously a banner-only event rendered with no image at all,
  // and the -mt-20 overlap pulled the title card up over bare grey.
  const heroImage = event.imageUrl || event.bannerUrl;
  const isVenueTba = Boolean(event.locationTba);
  const venueLine = isVenueTba
    ? 'To Be Announced'
    : formatEventLocation(event.venue, { fallback: 'Venue to be announced' });

  const venueQuery = [event.venue.name, event.venue.address, event.venue.city].filter(Boolean).join(', ');
  const resolvedMapsUrl = isVenueTba
    ? undefined
    : resolvePublicGoogleMapsUrl(
        event.venue.mapsUrl,
        event.venue.coordinates,
        venueQuery
      );
  const embedMapsUrl = isVenueTba
    ? undefined
    : getGoogleMapsEmbedUrl(
        event.venue.coordinates,
        venueQuery
      );

  const facts = [
    { key: 'date', label: 'Date', value: formatDate(event.startDate), Icon: CalendarDaysIcon },
    { key: 'time', label: 'Time', value: `${formatTime(event.startDate)} to ${formatTime(event.endDate)}`, Icon: ClockIcon },
    { key: 'venue', label: 'Venue', value: venueLine, Icon: MapPinIcon, mapsUrl: resolvedMapsUrl, isTba: isVenueTba }
  ];

  const step = (index: number) => ({ animationDelay: `${index * 90}ms` });

  return (
    <div className="min-h-page bg-surface-container-low canvas-dots">
      {/* Sticky Preview Header Banner */}
      {effectiveIsPreview && (
        <aside aria-label="Preview mode banner" className="sticky top-0 z-50 bg-secondary-container text-on-secondary-container border-b border-outline-variant px-4 py-2.5 shadow-sm">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-2.5 font-medium">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-on-primary text-xs font-semibold uppercase tracking-wider">
                <EyeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Preview Mode
              </span>
              <span className="font-semibold text-on-surface">This is a preview page only</span>
              <span className="hidden lg:inline text-on-surface-variant text-xs">— Submissions will not affect live data</span>
              <span className="capitalize px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-outline-variant text-on-surface">
                Status: {event.status || 'Draft'}
              </span>
              <span className="capitalize px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-outline-variant text-on-surface">
                Registration: {event.registrationStatus || 'open'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/events/${resolvedEventId || event.id}`}
                className="inline-flex min-h-[48px] sm:min-h-[36px] items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-on-surface hover:bg-surface-container font-medium border border-outline-variant text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Return to Workspace
              </Link>
            </div>
          </div>
        </aside>
      )}

      <a href="#details" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:font-medium focus:text-primary focus:shadow-lg">
        Skip to event details
      </a>

      {/* Hero. Dark surface from the documented ink neutral, so the headline
          stays high-contrast against any banner an organizer uploads, in
          direct sunlight and on a dim projector alike. MD3's inverse pair is
          exactly this case: light ink on a dark ground. */}
      <header className="relative isolate overflow-hidden bg-inverse-surface">
        {heroImage && (
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45"
          />
        )}
        {/* Scrim weighted to the bottom so the title block never fights the
            image, whatever the crop. The top stop stays heavy because venue
            photos are unpredictable and the headline sits high. */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-t from-inverse-surface via-inverse-surface/85 to-inverse-surface/65"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <div className="max-w-3xl">
            {event.category && (
              <p className="animate-hero-in motion-reduce:animate-none inline-flex items-center rounded-full bg-inverse-on-surface/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-container ring-1 ring-inset ring-inverse-on-surface/20" style={step(0)}>
                {event.category}
              </p>
            )}

            <h1
              className="animate-hero-in motion-reduce:animate-none mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-inverse-on-surface break-words"
              style={step(1)}
            >
              {event.title}
            </h1>

            {(event.shortDescription || event.description) && (
              <p
                className="animate-hero-in motion-reduce:animate-none mt-5 text-lg sm:text-xl leading-relaxed text-inverse-on-surface max-w-2xl"
                style={step(2)}
              >
                {event.shortDescription || event.description}
              </p>
            )}

            <div
              className="animate-hero-in motion-reduce:animate-none mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={step(3)}
            >
              {/* The hero actions stay hand-rolled on purpose. The MD3 palette
                  has no variant that is legible on a dark ground - `tonal`
                  renders a light container, `text` renders the primary fill -
                  so overriding one would mean fighting the primitive's own
                  colour classes, whose cascade order is not the author's to
                  pick. They already carry the 48px floor and a visible focus
                  ring, which is what `tests/unit/publicEventPage.test.ts`
                  holds them to. */}
              {isRegistrationClosed ? (
                <>
                  <button
                    type="button"
                    disabled
                    aria-label="Registration closed"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-8 rounded-xl bg-inverse-on-surface/10 text-inverse-on-surface font-semibold ring-1 ring-inset ring-inverse-on-surface/20 cursor-not-allowed"
                  >
                    <ExclamationTriangleIcon className="w-5 h-5" aria-hidden="true" />
                    Registration closed
                  </button>
                  {effectiveIsPreview && (
                    <button
                      type="button"
                      onClick={openRegistrationModal}
                      aria-label="Preview registration form"
                      className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl bg-primary text-on-primary font-semibold transition-[color,background-color,box-shadow,transform] duration-fast ease-quart hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-inverse-on-surface focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-surface"
                    >
                      <EyeIcon className="w-5 h-5" aria-hidden="true" />
                      Preview form
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={openRegistrationModal}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-8 rounded-xl bg-primary text-on-primary font-semibold transition-[color,background-color,box-shadow,transform] duration-fast ease-quart hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-inverse-on-surface focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-surface"
                >
                  <CheckCircleIcon className="w-5 h-5" aria-hidden="true" />
                  {hasPaidTicketOptions ? 'Register now' : 'Register for free'}
                </button>
              )}

              <button
                type="button"
                onClick={copyEventLink}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-xl bg-inverse-on-surface/10 text-inverse-on-surface font-medium ring-1 ring-inset ring-inverse-on-surface/20 transition-colors duration-fast ease-quart hover:bg-inverse-on-surface/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-inverse-on-surface focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-surface"
              >
                <ClipboardDocumentIcon className="w-5 h-5" aria-hidden="true" />
                Copy link
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="details" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Preview Mode In-Page Banner */}
        {effectiveIsPreview && (
          <Reveal className="mb-6">
            <div
              role="status"
              className="rounded-xl border border-warning/30 bg-warning-container/70 p-4 sm:p-5 text-on-warning-container"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-warning-container p-2 text-warning shrink-0 border border-warning/20">
                    <EyeIcon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-on-warning-container">
                      This is a preview page only
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-on-warning-container/85 leading-relaxed">
                      You are previewing this event as an organizer. All registrations, ticket selections, and form submissions in preview mode are simulated and will not create live attendee records or charge payments.
                    </p>
                  </div>
                </div>
                <Link
                  to={`/events/${resolvedEventId || event.id}`}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-xs sm:text-sm font-medium text-on-surface border border-outline-variant hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
                >
                  <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
                  Return to Workspace
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* Facts. One divided band rather than three identical icon cards:
            denser, no repeated boxes, and the labels line up so the three values
            can be scanned against each other. */}
        <Reveal>
          <dl className="grid grid-cols-1 divide-y divide-outline-variant sm:grid-cols-3 sm:divide-y-0 sm:divide-x border border-outline-variant bg-surface rounded-xl overflow-hidden">
            {facts.map(({ key, label, value, Icon, mapsUrl, isTba }: any) => (
              <div key={key} className="flex items-start gap-3 p-5">
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">{label}</dt>
                  <dd className="mt-1 text-base text-on-surface break-words flex items-center gap-2">
                    <span>{value}</span>
                    {isTba && (
                      <span className="inline-flex items-center rounded-full bg-secondary-container px-2 py-0.5 text-xs font-semibold text-on-secondary-container">
                        TBA
                      </span>
                    )}
                  </dd>
                  {mapsUrl && event.venue.type !== 'online' && !isTba && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium underline underline-offset-2 mt-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                    >
                      <span>View on Google Maps</span>
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </dl>
        </Reveal>

        {isRegistrationClosed && (
          <Reveal className="mt-6">
            <div className="rounded-xl bg-warning-container border border-outline-variant p-6" role="status">
              <h2 className="text-lg font-bold text-on-surface">Registration is closed</h2>
              <p className="mt-2 text-on-surface leading-relaxed max-w-2xl">
                This event has reached capacity or passed its registration deadline. The details below are still
                here if you would like to know what you missed.
              </p>
            </div>
          </Reveal>
        )}

        {event.description && (
          <Reveal className="mt-6">
            <section className="rounded-xl border border-outline-variant bg-surface p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Details</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">About this event</h2>
              <p className="mt-4 w-full text-on-surface leading-relaxed whitespace-pre-wrap break-words">
                {event.description}
              </p>
            </section>
          </Reveal>
        )}

        {event.venue.type !== 'online' && !isVenueTba && (event.venue.name || event.venue.address) && (
          <Reveal className="mt-6">
            <section className="rounded-xl border border-outline-variant bg-surface p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Location</p>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
                    {event.venue.name || 'Event Venue'}
                  </h2>
                  {event.venue.address && (
                    <p className="mt-2 text-base text-on-surface-variant max-w-[65ch]">
                      {event.venue.address}
                      {event.venue.city && !event.venue.address.includes(event.venue.city) ? `, ${event.venue.city}` : ''}
                    </p>
                  )}
                </div>
                {resolvedMapsUrl && (
                  <div className="shrink-0">
                    <a
                      href={resolvedMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-primary text-on-primary px-5 py-2.5 font-semibold transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <MapPinIcon className="h-5 w-5" aria-hidden="true" />
                      <span>View on Google Maps</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Keyless Google Maps Embed Preview */}
              {embedMapsUrl && (event.venue.coordinates || event.venue.address || event.venue.name) && (
                <div className="mt-6 overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
                  <iframe
                    src={embedMapsUrl}
                    title={event.venue.name ? `Google Map of ${event.venue.name}` : 'Event Venue Google Map'}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    className="w-full h-[260px] sm:h-[320px] border-0 block"
                  />
                </div>
              )}
            </section>
          </Reveal>
        )}

        {event.speakersTba ? (
          <Reveal className="mt-10 sm:mt-14">
            <section className="rounded-xl border border-outline-variant bg-surface p-6 sm:p-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-success">Lineup</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">Meet the speakers</h2>
              <div className="mt-4 max-w-md mx-auto rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 p-6">
                <p className="text-base font-semibold text-on-surface">Speakers To Be Announced</p>
                <p className="mt-1 text-sm text-on-surface-variant leading-relaxed">
                  The speaker lineup for this event will be revealed soon. Check back closer to the event date!
                </p>
              </div>
            </section>
          </Reveal>
        ) : event.speakers && event.speakers.length > 0 ? (
          <section className="mt-10 sm:mt-14">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-success">Lineup</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">Meet the speakers</h2>
            </Reveal>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {event.speakers.map((speaker, index) => (
                <Reveal key={index} delay={index * 80}>
                  <article className="group h-full rounded-xl border border-outline-variant bg-surface p-6 transition-[border-color,box-shadow] duration-fast ease-quart hover:border-outline hover:shadow-elevation-2 focus-within:border-outline">
                    <div className="flex items-start gap-4">
                      {speaker.photoUrl ? (
                        <img
                          src={speaker.photoUrl}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-16 h-16 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className="w-16 h-16 flex-shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center text-2xl font-bold"
                          aria-hidden="true"
                        >
                          {speaker.name.charAt(0)}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-on-surface transition-colors duration-fast ease-quart group-hover:text-primary-hover break-words">
                          {speaker.name}
                        </h3>
                        {speaker.title && <p className="mt-0.5 text-sm text-primary-hover font-medium break-words">{speaker.title}</p>}
                        {speaker.company && <p className="text-sm text-on-surface-variant break-words">{speaker.company}</p>}
                        {speaker.bio && (
                          <p className="mt-3 text-sm text-on-surface-variant leading-relaxed max-w-[65ch]">{speaker.bio}</p>
                        )}
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {/* Public Page Footer */}
      <footer className="mt-16 border-t border-outline-variant/60 bg-surface-container-low/50 py-8 text-center text-xs text-on-surface-variant">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            © {new Date().getFullYear()} TeamApo Hub •{' '}
            <a
              href="https://gdgdavao.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GDG Davao
            </a>
            . Built for the Davao Tech Community.
          </p>
          <div className="flex items-center gap-4 font-medium">
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms-of-service" className="text-primary hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>

      {/* Registration Modal */}
      {event && (
        <RegistrationModal
          isOpen={isModalOpen}
          onClose={closeRegistrationModal}
          event={event}
          registrationForm={registrationForm}
          isPreview={effectiveIsPreview}
        />
      )}
    </div>
  );
};

export default EventRegistrationPage;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  MapPinIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShareIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { EventService } from '../../services/eventService';
import RegistrationModal from '../../components/public/RegistrationModal';
import { Event, FormField } from '../../types';
import toast from 'react-hot-toast';
import usePageTitle from '../../hooks/usePageTitle';
import useSEO from '../../hooks/useSEO';
import { getDownloadUrlFromPath } from '../../utils/storageUtils';

const EventRegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] = useState<FormField[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [metaImageUrl, setMetaImageUrl] = useState<string>('https://github.com/gdgdavao/assets-cdn/blob/main/banner.png?raw=true');
  const [imageResolved, setImageResolved] = useState(false);

  // Set page title
  usePageTitle();

  // Resolve public URL for social sharing image when event changes
  useEffect(() => {
    const resolveImage = async () => {
      console.log('🖼️ Image Resolution: Starting...', {
        hasEvent: !!event,
        eventImageUrl: event?.imageUrl,
        eventBannerUrl: event?.bannerUrl
      });

      if (!event) {
        console.log('⚠️ Image Resolution: No event, using default banner');
        setMetaImageUrl('https://github.com/gdgdavao/assets-cdn/blob/main/banner.png?raw=true');
        setImageResolved(true);
        return;
      }

      const raw = event.imageUrl || event.bannerUrl;
      if (!raw) {
        console.log('⚠️ Image Resolution: No image URL in event, using default banner');
        setMetaImageUrl('https://github.com/gdgdavao/assets-cdn/blob/main/banner.png?raw=true');
        setImageResolved(true);
        return;
      }

      // If already an absolute URL, use it; otherwise resolve from storage path
      if (/^https?:\/\//i.test(raw)) {
        console.log('✅ Image Resolution: Using absolute URL', { url: raw });
        setMetaImageUrl(raw);
        setImageResolved(true);
        return;
      }

      // This is a Firebase Storage path, resolve it to a public URL
      console.log('🔄 Image Resolution: Resolving Firebase Storage path', { path: raw });
      try {
        const url = await getDownloadUrlFromPath(raw);
        if (url) {
          console.log('✅ Image Resolution: Successfully resolved Firebase Storage URL', { url });
          setMetaImageUrl(url);
        } else {
          console.warn('⚠️ Image Resolution: Failed to resolve, using default banner');
          setMetaImageUrl('https://github.com/gdgdavao/assets-cdn/blob/main/banner.png?raw=true');
        }
        setImageResolved(true);
      } catch (error) {
        console.error('❌ Image Resolution: Error resolving Firebase Storage URL', error);
        setMetaImageUrl('https://github.com/gdgdavao/assets-cdn/blob/main/banner.png?raw=true');
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

    console.log('🎨 SEO Update: Setting meta tags with resolved image', {
      eventTitle: event?.title,
      metaImageUrl,
      isEventImage: metaImageUrl !== 'https://github.com/gdgdavao/assets-cdn/blob/main/banner.png?raw=true'
    });
  }, [imageResolved, event, metaImageUrl]);

  useSEO({
    title: event ? `${event.title} | TeamApo Hub` : 'Event Registration | TeamApo Hub',
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
        name: event.organizer.name,
        email: event.organizer.email
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

  // Load event data
  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) {
        setError('Event ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const eventData = await EventService.getEvent(eventId);
        
        if (!eventData) {
          setError('Event not found');
          return;
        }

        // Check if event is published - check both status and isPublished for robustness
        console.log('🔍 Registration Page: Event status check', {
          eventId,
          status: eventData.status,
          isPublished: eventData.isPublished
        });
        
        if (eventData.status !== 'published' || !eventData.isPublished) {
          console.log('❌ Registration Page: Event not published, blocking access');
          setError('This event is not yet published');
          return;
        }
        
        console.log('✅ Registration Page: Event is published, allowing access');

        setEvent(eventData);
        
        // Load registration form
        const formFields = await EventService.getEventRegistrationForm(eventId);
        setRegistrationForm(formFields);
        
      } catch (err) {
        console.error('Error loading event:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const copyEventLink = () => {
    const url = `${window.location.origin}/events/${eventId}/register`;
    navigator.clipboard.writeText(url);
    toast.success('Event link copied to clipboard!');
  };

  const openRegistrationModal = () => {
    setIsModalOpen(true);
  };

  const closeRegistrationModal = () => {
    setIsModalOpen(false);
  };

  const toJSDate = (value: any): Date | null => {
    if (!value) return null;
    // Firestore Timestamp instance
    if (typeof value?.toDate === 'function') {
      try { return value.toDate(); } catch { /* fallthrough */ }
    }
    // Emulator/plain timestamp object { seconds, nanoseconds }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }
    // ISO string or number
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The event you are looking for does not exist or is no longer available.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Event Image */}
      <div className="relative">
        {/* Event Banner/Image */}
        {event.imageUrl && (
          <div className="h-96 bg-blue-600 relative overflow-hidden">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>
        )}
        
        {/* Hero Content */}
        <div className="relative -mt-20 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
              {/* Event Header */}
              <div className="p-8 bg-white">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {event.category?.toUpperCase()}
                      </span>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">{event.title}</h1>
                    <p className="text-xl text-gray-600 leading-relaxed">
                      {event.shortDescription || event.description}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={openRegistrationModal}
                      className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <CheckCircleIcon className="w-5 h-5 mr-2" />
                      Register Now
                    </button>
                    <button
                      onClick={copyEventLink}
                      className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <ClipboardDocumentIcon className="w-5 h-5 mr-2" />
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
            {/* Event Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CalendarDaysIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Date</h3>
                    <p className="text-gray-600 font-medium text-sm">{formatDate(event.startDate)}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ClockIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Time</h3>
                    <p className="text-gray-600 font-medium text-sm">
                      {formatTime(event.startDate)} - {formatTime(event.endDate)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <MapPinIcon className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Venue</h3>
                    <p className="text-gray-600 font-medium text-sm">
                      {event.venue.type === 'online' ? 'Online Event' : `${event.venue.name || 'Venue'}, ${event.venue.city}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Description */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <div className="w-1 h-6 bg-blue-500 rounded-full mr-3"></div>
                About This Event
              </h2>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>

            {/* Speakers */}
            {event.speakers && event.speakers.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
                  <div className="w-2 h-8 bg-green-500 rounded-full mr-4"></div>
                  Meet Our Speakers
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {event.speakers.map((speaker, index) => (
                    <div key={index} className="group p-8 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all duration-300 transform hover:-translate-y-1">
                      <div className="text-center">
                        <div className="relative inline-block mb-6">
                          {speaker.photoUrl ? (
                            <img
                              src={speaker.photoUrl}
                              alt={speaker.name}
                              className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-xl"
                            />
                          ) : (
                            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-xl">
                              {speaker.name.charAt(0)}
                            </div>
                          )}
                          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                            <CheckCircleIcon className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        
                        <h3 className="font-bold text-gray-900 text-2xl group-hover:text-blue-600 transition-colors mb-3">
                          {speaker.name}
                        </h3>
                        {speaker.title && (
                          <p className="text-blue-600 font-semibold text-lg mb-3">{speaker.title}</p>
                        )}
                        {speaker.company && (
                          <p className="text-gray-600 text-base mb-6 font-medium">{speaker.company}</p>
                        )}
                        
                        {speaker.bio && (
                          <>
                            <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600 text-base leading-relaxed">{speaker.bio}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Registration Modal */}
      {event && (
        <RegistrationModal
          isOpen={isModalOpen}
          onClose={closeRegistrationModal}
          event={event}
          registrationForm={registrationForm}
        />
      )}
    </div>
  );
};

export default EventRegistrationPage;

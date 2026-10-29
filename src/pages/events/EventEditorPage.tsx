import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { useAbility } from '@casl/react';
import { asEvent } from '../../auth/ability';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input, LoadingSpinner, ProgressBar, Select, Badge } from '../../components/UI';
import { functions } from '../../config/firebase';
import EventService from '../../services/eventService';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PhotoIcon,
  CheckCircleIcon,
  TicketIcon,
  ArrowLeftIcon,
  UserIcon,
  ShareIcon,
  LightBulbIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';
import FormBuilder from './components/FormBuilder';
import PhotoUpload from './components/PhotoUpload';
import VenueLocationPicker from './components/VenueLocationPicker';
import { TicketType, EventStatus, RegistrationStatus, FormField } from '../../types';
import { logger } from '../../utils/logger';
import AppShell from '../../layout/AppShell';
import { toDateSafe } from '../../utils/dateUtils';

interface PaymentConfig {
  id: string;
  name: string;
  qrCodeImage?: File;
  qrCodeUrl?: string;
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    swiftCode?: string;
  };
  instructions: string;
  requiresProof: boolean;
  requiresTransactionId: boolean;
  paymentFields?: FormField[]; // Additional form fields for payment verification
  isActive: boolean;
}

interface EventFormData {
  // Basic Info
  title: string;
  description: string;
  shortDescription: string;
  imageUrl?: string;

  // Date & Time
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;

  // Venue
  venueType: 'online' | 'offline' | 'hybrid';
  venueName?: string;
  venueAddress?: string;
  city: string;
  venueCoordinates?: {
    lat: number;
    lng: number;
  };
  venuePlaceId?: string;
  venueMapsUrl?: string;
  locationTba?: boolean;

  // Speakers (as per PRD requirement)
  speakers: {
    id: string;
    name: string;
    title: string;
    company?: string;
    bio: string;
    photoUrl?: string;
  }[];
  speakersTba?: boolean;

  // Pricing & Tickets
  ticketTypes: TicketType[];

  // Legacy pricing (for backward compatibility)
  isPaid: boolean;
  ticketPrice: number;
  currency: string;
  maxAttendees?: number;

  // Forms
  registrationForm: FormField[];

  // Payment (for paid events)
  paymentConfigs?: PaymentConfig[];

  // Settings
  category: string;
  tags: string[];
  requirements: string[];
  registrationDeadline?: string;
  registrationStatus: 'open' | 'closed' | 'walk-in-only';
  status?: EventStatus;
}

const EventEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId: routeEventId } = useParams<{ eventId?: string }>();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const ability = useAbility();

  // /events/create and /events/edit/:eventId both render this page. The param is
  // the honest signal; the pathname substring is a belt-and-braces fallback for a
  // deep link that lost its param.
  const isEditMode = Boolean(routeEventId) || location.pathname.includes('/edit/');

  // Route protection: verify ability to create when in create mode
  useEffect(() => {
    if (!authLoading && !isEditMode && !ability.can('create', 'Event')) {
      toast.error('You do not have permission to create events.');
      navigate('/forbidden', { replace: true });
    }
  }, [authLoading, isEditMode, ability, navigate]);

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const targetEventId = routeEventId || eventId;
  const [speakerPhotoFiles, setSpeakerPhotoFiles] = useState<{ [speakerId: string]: File }>({});
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    shortDescription: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezone: 'Asia/Manila',
    venueType: 'offline',
    city: 'Davao City',
    locationTba: false,

    // Speakers
    speakers: [],
    speakersTba: false,

    // New ticket system
    ticketTypes: [],

    // Legacy pricing (for backward compatibility)
    isPaid: false,
    ticketPrice: 0,
    currency: 'PHP',
    registrationForm: [
      { id: '1', type: 'text', label: 'Full Name', required: true, gridSize: 'full' },
      { id: '2', type: 'email', label: 'Email Address', required: true, gridSize: 'half' },
      { id: '3', type: 'phone', label: 'Phone Number', required: true, gridSize: 'half' }
    ],
    category: 'workshop',
    tags: [],
    requirements: [],
    paymentConfigs: [],
    registrationStatus: 'open',
    status: 'draft'
  });

  // Helper function to create a default payment configuration
  const createDefaultPaymentConfig = (name: string = 'Payment Method'): PaymentConfig => ({
    id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    bankDetails: { bankName: '', accountName: '', accountNumber: '' },
    instructions: 'Please follow the payment instructions below and upload your payment proof.',
    requiresProof: true,
    requiresTransactionId: true,
    paymentFields: createDefaultPaymentFields(),
    isActive: true
  });

  // Helper functions for managing multiple payment configurations
  const updatePaymentConfig = (index: number, updates: Partial<PaymentConfig>) => {
    setFormData(prev => ({
      ...prev,
      paymentConfigs: prev.paymentConfigs?.map((config, i) => 
        i === index ? { ...config, ...updates } : config
      ) || []
    }));
  };

  const removePaymentConfig = (index: number) => {
    setFormData(prev => ({
      ...prev,
      paymentConfigs: prev.paymentConfigs?.filter((_, i) => i !== index) || []
    }));
  };

  const addPaymentConfig = () => {
    setFormData(prev => ({
      ...prev,
      paymentConfigs: [...(prev.paymentConfigs || []), createDefaultPaymentConfig(`Payment Method ${(prev.paymentConfigs?.length || 0) + 1}`)]
    }));
  };

  const handleQRCodeUploadForConfig = (e: React.ChangeEvent<HTMLInputElement>, configIndex: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updatePaymentConfig(configIndex, {
          qrCodeImage: file,
          qrCodeUrl: event.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Load event data if editing
  useEffect(() => {
    const idToLoad = routeEventId;
    if (idToLoad) {
      loadEventData(idToLoad);
    } else if (isEditMode) {
      const eventIdFromUrl = location.pathname.split('/').pop();
      if (eventIdFromUrl && eventIdFromUrl !== 'create') {
        loadEventData(eventIdFromUrl);
      }
    }
  }, [isEditMode, routeEventId, location.pathname]);

  // Automatically update isPaid flag when ticket types have prices
  useEffect(() => {
    const hasPaidTickets = formData.ticketTypes.some(ticket => ticket.price > 0);
    if (hasPaidTickets && !formData.isPaid) {
      setFormData(prev => ({
        ...prev,
        isPaid: true,
        paymentConfigs: prev.paymentConfigs && prev.paymentConfigs.length > 0 
          ? prev.paymentConfigs 
          : [createDefaultPaymentConfig('Primary Payment Method')]
      }));
    } else if (!hasPaidTickets && formData.isPaid && !formData.ticketTypes.some(ticket => ticket.price > 0)) {
      // Only clear payment configs if explicitly switching to free event AND no tickets have prices
      setFormData(prev => ({
        ...prev,
        isPaid: false,
        // Don't clear paymentConfigs - keep them for when user adds paid tickets later
      }));
    }
  }, [formData.ticketTypes]);

  // Helper function to safely convert Firestore timestamps to Date objects
  const convertTimestampToDate = (timestamp: any): Date => {
    return toDateSafe(timestamp) ?? new Date();
  };

  const toLocalDateTimeInput = (value: unknown): string => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return value;
    }
    const date = toDateSafe(value);
    if (!date) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const loadEventData = async (eventId: string) => {
    try {
      setLoading(true);
      const event = await EventService.getEvent(eventId);
      if (event) {
        // Enforce ABPAC / RBAC on editing: only admins or owning organizers with update capability may edit
        const isPermittedToEdit = ability.can('read', 'all') || ability.can('update', asEvent(event));
        if (!isPermittedToEdit) {
          toast.error('You do not have permission to edit this event.');
          navigate('/forbidden', { replace: true });
          return;
        }

        setEventId(eventId);
        if (event.slug) {
          setEventSlug(event.slug);
        }
        
        // Safely convert dates
        const startDate = convertTimestampToDate(event.startDate);
        const endDate = convertTimestampToDate(event.endDate);
        const registrationDeadline = event.registrationDeadline ? convertTimestampToDate(event.registrationDeadline) : null;
        
        // Load registration form
        const registrationForm = await EventService.getEventRegistrationForm(eventId);
        
        // Convert Event to EventFormData
        const eventFormData: EventFormData = {
          title: event.title,
          description: event.description,
          shortDescription: event.shortDescription,
          imageUrl: event.imageUrl || undefined, // Ensure it's either string or undefined, not null
          startDate: startDate.toISOString().split('T')[0],
          startTime: startDate.toTimeString().slice(0, 5),
          endDate: endDate.toISOString().split('T')[0],
          endTime: endDate.toTimeString().slice(0, 5),
          timezone: event.timezone,
          venueType: event.venue.type,
          venueName: event.venue.name,
          venueAddress: event.venue.address,
          city: event.venue.city,
          venueCoordinates: event.venue.coordinates,
          venuePlaceId: event.venue.placeId,
          venueMapsUrl: event.venue.mapsUrl,
          locationTba: Boolean(event.locationTba),
          speakers: event.speakers || [],
          speakersTba: Boolean(event.speakersTba),
          ticketTypes: event.ticketTypes,
          isPaid: event.ticketTypes.some(ticket => ticket.price > 0),
          ticketPrice: event.ticketTypes[0]?.price || 0,
          currency: event.ticketTypes[0]?.currency || 'PHP',
          maxAttendees: event.maxAttendees,
          registrationForm: registrationForm,
          category: event.category,
          tags: event.tags,
          requirements: event.requirements || [],
          registrationDeadline: registrationDeadline?.toISOString().split('T')[0],
          paymentConfigs: (event as any).paymentConfigs || [],
          registrationStatus: event.registrationStatus || 'open',
          status: event.status || 'draft'
        };
        
        // Debug logging for payment configs
        logger.log('Loading event data - paymentConfigs from Firestore:', (event as any).paymentConfigs);
        if ((event as any).paymentConfigs) {
          (event as any).paymentConfigs.forEach((config: any, index: number) => {
            logger.log(`Payment config ${index}:`, config);
            logger.log(`  - qrCodeImage:`, config.qrCodeImage);
            logger.log(`  - qrCodeUrl:`, config.qrCodeUrl);
          });
        }
        if (event.imageUrl) {
          setCoverPreviewUrl(event.imageUrl);
        } else {
          setCoverPreviewUrl(null);
        }
        setFormData(eventFormData);
      }
    } catch (error) {
      toast.error('Failed to load event data. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareEvent = (eventId: string, eventTitle: string) => {
    const shareUrl = `${window.location.origin}/e/${eventSlug || eventId}`;
    
    // Copy link to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success(`Registration link for "${eventTitle}" copied to clipboard.`, {
        duration: 4000,
      });
    }).catch(() => {
      toast.error('Failed to copy link to clipboard. Please try again.');
    });
  };

  const handleSaveEvent = async (publish: boolean = false) => {
    // Wait for auth to be fully initialized
    if (authLoading) {
      toast.error('Authentication in progress. Please wait a moment.');
      return;
    }
    
    if (!currentUser) {
      toast.error('You must be signed in to create an event.');
      return;
    }

    let toastId: string | undefined;
    try {
      setIsSubmitting(true);

      // Client-side validation first
      if (!formData.title || !formData.description || !formData.startDate || !formData.startTime) {
        toast.error('Please complete all required fields.');
        setIsSubmitting(false);
        return;
      }

      // Ensure auth token is fresh before making function calls
      try {
        await currentUser.getIdToken(true); // Force token refresh
        
        // Check if user document exists in Firestore
        if (!userProfile) {
          toast.error('User profile not found. Please sign out and sign in again.');
          setIsSubmitting(false);
          return;
        }
      } catch (authError) {
        toast.error('Authentication expired. Please sign in again.');
        setIsSubmitting(false);
        return;
      }

      // Server-side validation via callable function with fallback to client-side checks
      try {
        const validateEventData = httpsCallable(functions, 'validate_event_data');
        const validation: any = await validateEventData({ eventData: formData, isEditMode });
        if (!validation?.data?.isValid) {
          const errs = validation?.data?.errors || ['Validation failed'];
          toast.error(errs.join(', '));
          setIsSubmitting(false);
          return;
        }
      } catch (_fnErr) {
        // fall back to simple local checks below
      }
      
      // Basic client-side validation (keeping it simple for now as a fallback)
      if (!formData.title.trim()) {
        toast.error('Event title is required');
        setIsSubmitting(false);
        return;
      }
      
      if (!formData.description.trim()) {
        toast.error('Event description is required');
        setIsSubmitting(false);
        return;
      }

      // Validate dates
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      const now = new Date();
      
      // Only validate past dates for new events
      // When editing, allow keeping the same date even if it's today or in the past
      if (!isEditMode && startDateTime < now) {
        toast.error('Event start date must be in the future.');
        setIsSubmitting(false);
        return;
      }
      
      if (endDateTime <= startDateTime) {
        toast.error('Event end date must be after the start date.');
        setIsSubmitting(false);
        return;
      }

      // Validate ticket sales windows (validFrom <= validUntil)
      for (let i = 0; i < formData.ticketTypes.length; i++) {
        const t = formData.ticketTypes[i];
        const vf = toDateSafe((t as any).validFrom);
        const vu = toDateSafe((t as any).validUntil);
        if (vf && vu && vf.getTime() > vu.getTime()) {
          toast.error(`Ticket "${t.name || `#${i + 1}`}": Sales start must be before sales deadline.`);
          setIsSubmitting(false);
          return;
        }
      }

      // Centralized notifications
      toastId = toast.loading(
        publish
          ? (isEditMode ? 'Publishing event…' : 'Creating and publishing event…')
          : (isEditMode ? 'Updating event…' : 'Creating event…')
      );
      const warnings: string[] = [];

      let savedEventId: string;

      // Create or update event first (without base64 image data or local blob previews)
      const eventDataWithoutBase64Image = {
        ...formData,
        locationTba: Boolean(formData.locationTba),
        speakersTba: Boolean(formData.speakersTba),
        imageUrl: selectedCoverFile ? undefined : formData.imageUrl,
        speakers: (formData.speakers || []).map((s) => ({
          ...s,
          photoUrl: s.photoUrl && (s.photoUrl.startsWith('data:') || s.photoUrl.startsWith('blob:')) ? undefined : s.photoUrl
        }))
      };

      if (isEditMode && targetEventId) {
        // Update existing event using targetEventId (resolves route param or loaded eventId)
        await EventService.updateEvent(targetEventId, eventDataWithoutBase64Image);
        savedEventId = targetEventId;
      } else {
        // Create new event
        savedEventId = await EventService.createEvent(eventDataWithoutBase64Image, currentUser.uid);
        setEventId(savedEventId);
      }

      // Smart Status Preservation:
      // When publishing explicitly: set to 'published'.
      // When saving in edit mode: preserve existing event status (published, ongoing, draft, etc.).
      // When saving in create mode: 'draft'.
      const targetStatus: EventStatus = publish
        ? 'published'
        : (isEditMode ? (formData.status || 'draft') : 'draft');

      await EventService.updateEventStatus(savedEventId, targetStatus);

      // Upload event image if a new cover file was selected
      if (selectedCoverFile) {
        try {
          await EventService.uploadEventImage(savedEventId, selectedCoverFile);
        } catch (error) {
          warnings.push('Event cover image upload failed');
        }
      } else if (coverPreviewUrl === null && isEditMode) {
        // Cover image was explicitly removed in edit mode
        try {
          await EventService.updateEvent(savedEventId, { imageUrl: '' });
        } catch (error) {
          warnings.push('Failed to clear event cover image');
        }
      }

      // Upload payment QR codes if provided
      if (formData.paymentConfigs && formData.paymentConfigs.length > 0) {
        const updatedPaymentConfigs = [...formData.paymentConfigs];
        
        for (let i = 0; i < updatedPaymentConfigs.length; i++) {
          const config = updatedPaymentConfigs[i];
          // Only upload if there's a new File object (not an empty object from existing data)
          if (config.qrCodeImage && (config.qrCodeImage as any) instanceof File) {
            try {
              // Debug logging
              logger.log(`Processing QR upload for config ${i}:`, config.name);
              logger.log('config.qrCodeImage:', config.qrCodeImage);
              logger.log('config.qrCodeImage instanceof File:', config.qrCodeImage instanceof File);
              logger.log('config.qrCodeImage type:', typeof config.qrCodeImage);
              logger.log('config.qrCodeImage constructor:', config.qrCodeImage?.constructor?.name);
              
              const qrCodeUrl = await EventService.uploadPaymentQR(savedEventId, config.qrCodeImage);
              updatedPaymentConfigs[i] = {
                ...config,
                qrCodeUrl
              };
            } catch (error) {
              logger.error(`QR upload error for ${config.name}:`, error);
              warnings.push(`Payment QR upload failed for ${config.name}`);
            }
          } else if (config.qrCodeImage && !((config.qrCodeImage as any) instanceof File)) {
            // Clean up invalid qrCodeImage objects (from existing data)
            logger.log(`Skipping QR upload for ${config.name} - no new file provided`);
            updatedPaymentConfigs[i] = {
              ...config,
              qrCodeImage: undefined // Remove the invalid object
            };
          }
        }
        
        // Clean payment configs before saving - remove qrCodeImage fields entirely
        const cleanedPaymentConfigs = updatedPaymentConfigs.map(config => {
          const { qrCodeImage, ...configWithoutFile } = config;
          return configWithoutFile;
        });
        
        // Update event with all payment configs
        await EventService.updateEvent(savedEventId, {
          paymentConfigs: cleanedPaymentConfigs // Use cleaned payment configs
        });
      }

      // Upload speaker photos if provided
      if (Object.keys(speakerPhotoFiles).length > 0) {
        const updatedSpeakers = [...formData.speakers];
        
        for (const [speakerId, photoFile] of Object.entries(speakerPhotoFiles)) {
          try {
            const photoUrl = await EventService.uploadSpeakerPhoto(savedEventId, speakerId, photoFile);
            const speakerIndex = updatedSpeakers.findIndex(s => s.id === speakerId);
            if (speakerIndex !== -1) {
              updatedSpeakers[speakerIndex] = {
                ...updatedSpeakers[speakerIndex],
                photoUrl
              };
            }
          } catch (error) {
            const speaker = formData.speakers.find(s => s.id === speakerId);
            warnings.push(`Speaker photo upload failed for ${speaker?.name || 'Unknown speaker'}`);
          }
        }
        
        // Update event with all speakers (including photo URLs)
        await EventService.updateEvent(savedEventId, {
          speakers: updatedSpeakers
        });
      }

      // Note: Publishing is now handled via status update above

      // Fetch statistics post-save when editing to update any dashboards (non-blocking)
      if (isEditMode && savedEventId) {
        try {
          const getEventStatistics = httpsCallable(functions, 'get_event_statistics');
          await getEventStatistics({ eventId: savedEventId });
        } catch (statsErr) {
          // Statistics function failed (non-blocking)
        }
      }

      // Show a single final success toast
      const baseMessage = isEditMode
        ? (publish ? 'Event updated and published.' : 'Event updated successfully.')
        : (publish ? 'Event created and published.' : 'Event saved as draft.');
      const finalMessage = warnings.length > 0
        ? `${baseMessage} Note: ${warnings.join('; ')}.`
        : baseMessage;
      toast.success(finalMessage, { id: toastId });

      // Navigate to event page
      setTimeout(() => {
        const resolvedEventId = savedEventId || targetEventId;
        if (resolvedEventId) {
          navigate(`/events/${resolvedEventId}`);
        } else {
          navigate('/events');
        }
      }, 1200);

    } catch (error) {
      if (error instanceof Error) {
        if (toastId) {
          toast.error(`Failed to save event: ${error.message}`, { id: toastId });
        } else {
          toast.error(`Failed to save event: ${error.message}`);
        }
      } else {
        if (toastId) {
          toast.error('Failed to save event. Please try again.', { id: toastId });
        } else {
          toast.error('Failed to save event. Please try again.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedCoverFile(file);
      setCoverPreviewUrl(URL.createObjectURL(file));
      setFormData(prev => ({
        ...prev,
        imageUrl: undefined
      }));
    }
  };

  const handleImageRemove = () => {
    setSelectedCoverFile(null);
    setCoverPreviewUrl(null);
    setFormData(prev => ({
      ...prev,
      imageUrl: undefined
    }));
  };

  // Helper function to create default payment verification fields
  const createDefaultPaymentFields = (): FormField[] => [
    {
      id: 'payment_proof',
      type: 'file',
      label: 'Payment Proof Screenshot',
      required: true,
      gridSize: 'full',
      description: 'Upload a screenshot of your payment transaction'
    },
    {
      id: 'transaction_id',
      type: 'text',
      label: 'Transaction ID / Reference Number',
      required: true,
      gridSize: 'full',
      placeholder: 'Enter transaction reference number',
      description: 'Provide the transaction ID for payment verification'
    }
  ];

  const steps = [
    { id: 0, title: 'Basic Information', icon: DocumentTextIcon },
    { id: 1, title: 'Date & Venue', icon: CalendarDaysIcon },
    { id: 2, title: 'Speaker Profiles', icon: UserIcon },
    { id: 3, title: 'Tickets & Pricing', icon: TicketIcon },
    { id: 4, title: 'Registration Form', icon: UserGroupIcon },
    { id: 5, title: 'Review & Publish', icon: CheckCircleIcon }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderBasicInfoStep();
      case 1:
        return renderDateVenueStep();
      case 2:
        return renderSpeakerProfilesStep();
      case 3:
        return renderTicketManagementStep();
      case 4:
        return renderRegistrationFormStep();
      case 5:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const renderBasicInfoStep = () => (
    <div className="space-y-6">

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Event Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="Enter event title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Short Description</label>
        <input
          type="text"
          value={formData.shortDescription}
          onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
          className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="Brief description for event cards"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Full Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={6}
          className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="Detailed event description"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Event Cover Image</label>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {coverPreviewUrl ? (
            <div className="relative">
              <img
                src={coverPreviewUrl}
                alt="Event cover preview"
                className="w-40 h-28 object-cover rounded-xl border border-outline-variant shadow-xs"
              />
              <button
                type="button"
                onClick={handleImageRemove}
                className="absolute -top-2 -right-2 bg-error text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold hover:bg-error/80 shadow-xs min-h-control"
                title="Remove image"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-40 h-28 border-2 border-outline-variant border-dashed rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors bg-white min-h-control">
              <PhotoIcon className="w-8 h-8 text-outline-variant" />
              <span className="mt-1 text-xs font-medium text-on-surface-variant">Upload Cover</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </label>
          )}
          <div className="flex-1 text-xs text-on-surface-variant space-y-1">
            <p className="font-medium text-on-surface">Recommended size: 1200×630 pixels (16:9 ratio)</p>
            <p>
              Upload an attractive event cover image to help draw attendees and enhance social sharing.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Select
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
          >
            <option value="workshop">Workshop</option>
            <option value="meetup">Meetup</option>
            <option value="conference">Conference</option>
            <option value="hackathon">Hackathon</option>
            <option value="networking">Networking</option>
            <option value="webinar">Webinar</option>
            <option value="study-jam">Study Jam</option>
            <option value="code-lab">Code Lab</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-2">Max Attendees</label>
          <input
            type="number"
            value={formData.maxAttendees || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, maxAttendees: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
            className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>

      <div>
        <Select
          id="registrationStatus"
          label="Registration Status"
          hint={
            formData.registrationStatus === 'open'
              ? 'Attendees can register online'
              : formData.registrationStatus === 'closed'
              ? 'Registration is closed, event details still visible'
              : 'Event is ongoing, accepting walk-ins only'
          }
          value={formData.registrationStatus}
          onChange={(e) => setFormData(prev => ({ ...prev, registrationStatus: e.target.value as 'open' | 'closed' | 'walk-in-only' }))}
        >
          <option value="open">Open - Accepting online registrations</option>
          <option value="closed">Closed - No new registrations</option>
          <option value="walk-in-only">Walk-In Only - On-going event</option>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Event Requirements</label>
        <div className="space-y-2">
          {formData.requirements.map((requirement, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={requirement}
                onChange={(e) => {
                  const newRequirements = [...formData.requirements];
                  newRequirements[index] = e.target.value;
                  setFormData(prev => ({ ...prev, requirements: newRequirements }));
                }}
                className="flex-1 px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                placeholder="Enter requirement (e.g., Laptop required, Basic Python knowledge)"
              />
              <button
                type="button"
                onClick={() => {
                  const newRequirements = formData.requirements.filter((_, i) => i !== index);
                  setFormData(prev => ({ ...prev, requirements: newRequirements }));
                }}
                className="px-3 py-2 text-error hover:bg-error-container/40 rounded-lg text-sm font-medium min-h-control"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, requirements: [...prev.requirements, ''] }))}
            className="w-full px-4 py-2.5 border-2 border-dashed border-outline-variant rounded-lg text-on-surface-variant hover:border-primary hover:text-primary transition-colors text-sm font-medium min-h-control"
          >
            + Add Requirement
          </button>
        </div>
        <p className="text-xs text-on-surface-variant mt-2">
          List any requirements or prerequisites for attendees (e.g., "Laptop required", "Basic Python knowledge")
        </p>
      </div>
    </div>
  );

  const renderDateVenueStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-2">Start Date</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-2">Start Time</label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
            className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-2">End Date</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-2">End Time</label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
            className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Venue Type</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'On-Site' },
            { value: 'hybrid', label: 'Hybrid' }
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, venueType: value as any }))}
              className={`p-4 border-2 rounded-xl text-center min-h-control transition-colors ${formData.venueType === value
                ? 'border-primary bg-primary-container text-on-primary-container font-semibold shadow-xs'
                : 'border-outline-variant hover:border-outline text-on-surface bg-white'
                }`}
            >
              <div className="font-medium text-base">{label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-4">
        <label className="flex items-start gap-3 cursor-pointer select-none min-h-control">
          <input
            type="checkbox"
            checked={Boolean(formData.locationTba)}
            onChange={(e) => setFormData(prev => ({ ...prev, locationTba: e.target.checked }))}
            className="mt-0.5 h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary"
          />
          <div>
            <span className="text-sm font-semibold text-on-surface">Location to be announced (TBA)</span>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Hides the specific venue location and map on the public registration page with a &quot;To Be Announced&quot; placeholder until you are ready to reveal it.
            </p>
          </div>
        </label>
      </div>

      {formData.venueType !== 'online' && (
        <VenueLocationPicker
          value={{
            venueName: formData.venueName,
            venueAddress: formData.venueAddress,
            city: formData.city,
            venueCoordinates: formData.venueCoordinates,
            venuePlaceId: formData.venuePlaceId,
            venueMapsUrl: formData.venueMapsUrl,
          }}
          onChange={(updated) => {
            setFormData(prev => ({
              ...prev,
              venueName: updated.venueName,
              venueAddress: updated.venueAddress,
              city: updated.city,
              venueCoordinates: updated.venueCoordinates,
              venuePlaceId: updated.venuePlaceId,
              venueMapsUrl: updated.venueMapsUrl,
            }));
          }}
        />
      )}
    </div>
  );

  const renderSpeakerProfilesStep = () => {
    const addSpeaker = () => {
      const newSpeaker = {
        id: `speaker_${Date.now()}`,
        name: '',
        title: '',
        company: '',
        bio: '',
        photoUrl: ''
      };
      setFormData(prev => ({
        ...prev,
        speakers: [...prev.speakers, newSpeaker]
      }));
    };

    const updateSpeaker = (index: number, updates: Partial<typeof formData.speakers[0]>) => {
      setFormData(prev => ({
        ...prev,
        speakers: prev.speakers.map((speaker, i) =>
          i === index ? { ...speaker, ...updates } : speaker
        )
      }));
    };

    const handleSpeakerPhotoChange = (speakerId: string, file: File | null, previewUrl?: string) => {
      if (file) {
        setSpeakerPhotoFiles(prev => ({ ...prev, [speakerId]: file }));
        // Update the speaker with the preview URL for immediate display
        const speakerIndex = formData.speakers.findIndex(s => s.id === speakerId);
        if (speakerIndex !== -1) {
          updateSpeaker(speakerIndex, { photoUrl: previewUrl });
        }
      }
    };

    const handleSpeakerPhotoRemove = (speakerId: string) => {
      setSpeakerPhotoFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[speakerId];
        return newFiles;
      });
      // Remove the photo URL from the speaker
      const speakerIndex = formData.speakers.findIndex(s => s.id === speakerId);
      if (speakerIndex !== -1) {
        updateSpeaker(speakerIndex, { photoUrl: undefined });
      }
    };

    const removeSpeaker = (index: number) => {
      setFormData(prev => ({
        ...prev,
        speakers: prev.speakers.filter((_, i) => i !== index)
      }));
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-on-surface">Speaker Profiles</h3>
            <p className="text-sm text-on-surface-variant">Add speakers to highlight at your event</p>
          </div>
          <button
            type="button"
            onClick={addSpeaker}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover min-h-control transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Speaker</span>
          </button>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-4">
          <label className="flex items-start gap-3 cursor-pointer select-none min-h-control">
            <input
              type="checkbox"
              checked={Boolean(formData.speakersTba)}
              onChange={(e) => setFormData(prev => ({ ...prev, speakersTba: e.target.checked }))}
              className="mt-0.5 h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary"
            />
            <div>
              <span className="text-sm font-semibold text-on-surface">Speakers to be announced (TBA)</span>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Displays a &quot;Speakers To Be Announced — Check back soon&quot; teaser section on the public registration page until the speaker lineup is ready to be revealed.
              </p>
            </div>
          </label>
        </div>

        {formData.speakers.length === 0 ? (
          <div className="text-center py-12 bg-surface-container-low/60 rounded-xl border border-dashed border-outline-variant">
            <UserIcon className="w-12 h-12 text-outline-variant mx-auto mb-3" />
            <h3 className="text-base font-semibold text-on-surface mb-1">No speakers yet</h3>
            <p className="text-sm text-on-surface-variant mb-4">Add your first speaker to get started</p>
            <button
              type="button"
              onClick={addSpeaker}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover min-h-control text-sm font-medium transition-colors"
            >
              Add Speaker
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {formData.speakers.map((speaker, index) => (
              <div key={speaker.id} className="border border-outline-variant rounded-xl p-6 bg-white shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-base font-semibold text-on-surface">
                    Speaker {index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeSpeaker(index)}
                    className="p-2 text-outline-variant hover:text-error min-h-control rounded-md"
                    title="Remove speaker"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Name *</label>
                    <input
                      type="text"
                      value={speaker.name}
                      onChange={(e) => updateSpeaker(index, { name: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                      placeholder="Speaker's full name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Title/Role *</label>
                    <input
                      type="text"
                      value={speaker.title}
                      onChange={(e) => updateSpeaker(index, { title: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                      placeholder="e.g., Senior Developer, CTO"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Company</label>
                    <input
                      type="text"
                      value={speaker.company || ''}
                      onChange={(e) => updateSpeaker(index, { company: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                      placeholder="Company name"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Speaker Photo</label>
                    <PhotoUpload
                      currentPhotoUrl={speaker.photoUrl}
                      onPhotoChange={(file, previewUrl) => handleSpeakerPhotoChange(speaker.id, file, previewUrl)}
                      onPhotoRemove={() => handleSpeakerPhotoRemove(speaker.id)}
                      placeholder="Upload Photo"
                      maxSize={5}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Bio *</label>
                    <textarea
                      value={speaker.bio}
                      onChange={(e) => updateSpeaker(index, { bio: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                      rows={3}
                      placeholder="Short bio about the speaker..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  const renderTicketManagementStep = () => {
    const addTicketType = () => {
      const newTicket: TicketType = {
        id: `ticket_${Date.now()}`,
        name: 'General Admission',
        description: '',
        price: 0,
        currency: 'PHP',
        maxQuantity: undefined,
        currentSold: 0,
        isActive: true,
        benefits: [],
        sortOrder: formData.ticketTypes.length
      };
      setFormData(prev => ({
        ...prev,
        ticketTypes: [...prev.ticketTypes, newTicket]
      }));
    };

    const updateTicketType = (index: number, updates: Partial<TicketType>) => {
      setFormData(prev => ({
        ...prev,
        ticketTypes: prev.ticketTypes.map((ticket, i) =>
          i === index ? { ...ticket, ...updates } : ticket
        )
      }));
    };

    const removeTicketType = (index: number) => {
      setFormData(prev => ({
        ...prev,
        ticketTypes: prev.ticketTypes.filter((_, i) => i !== index)
      }));
    };

    const moveTicketType = (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= formData.ticketTypes.length) return;

      setFormData(prev => {
        const newTicketTypes = [...prev.ticketTypes];
        [newTicketTypes[index], newTicketTypes[newIndex]] = [newTicketTypes[newIndex], newTicketTypes[index]];

        // Update sort order
        newTicketTypes.forEach((ticket, i) => {
          ticket.sortOrder = i;
        });

        return { ...prev, ticketTypes: newTicketTypes };
      });
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-on-surface">Ticket Types</h3>
            <p className="text-sm text-on-surface-variant">Configure different ticket types and pricing for your event</p>
          </div>
          <button
            type="button"
            onClick={addTicketType}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover min-h-control transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Ticket Type</span>
          </button>
        </div>

        {formData.ticketTypes.length === 0 ? (
          <div className="text-center py-12 bg-surface-container-low/60 rounded-xl border border-dashed border-outline-variant">
            <TicketIcon className="w-12 h-12 text-outline-variant mx-auto mb-3" />
            <h3 className="text-base font-semibold text-on-surface mb-1">No ticket types yet</h3>
            <p className="text-sm text-on-surface-variant mb-4">Create your first ticket type to get started</p>
            <button
              type="button"
              onClick={addTicketType}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover min-h-control text-sm font-medium transition-colors"
            >
              Add Ticket Type
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {formData.ticketTypes.map((ticket, index) => (
              <div key={ticket.id} className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-on-surface">Ticket Type {index + 1}</h4>
                  <div className="flex items-center space-x-2">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => moveTicketType(index, 'up')}
                        className="p-2 text-outline-variant hover:text-on-surface min-h-control rounded-md"
                        title="Move up"
                      >
                        <ArrowUpIcon className="w-4 h-4" />
                      </button>
                    )}
                    {index < formData.ticketTypes.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveTicketType(index, 'down')}
                        className="p-2 text-outline-variant hover:text-on-surface min-h-control rounded-md"
                        title="Move down"
                      >
                        <ArrowDownIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTicketType(index)}
                      className="p-2 text-outline-variant hover:text-error min-h-control rounded-md"
                      title="Remove ticket type"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Name *</label>
                    <input
                      type="text"
                      value={ticket.name}
                      onChange={(e) => updateTicketType(index, { name: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                      placeholder="e.g., General Admission, VIP, Student"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Price (₱) *</label>
                    <input
                      type="number"
                      value={ticket.price ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateTicketType(index, { price: (val === '' ? (undefined as any) : parseFloat(val)) });
                      }}
                      className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Description</label>
                    <textarea
                      value={ticket.description || ''}
                      onChange={(e) => updateTicketType(index, { description: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                      rows={2}
                      placeholder="Brief description of this ticket type"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Max Quantity</label>
                    <input
                      type="number"
                      value={ticket.maxQuantity || ''}
                      onChange={(e) => updateTicketType(index, {
                        maxQuantity: e.target.value ? parseInt(e.target.value, 10) : undefined
                      })}
                      className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                      min="1"
                      placeholder="Unlimited"
                    />
                  </div>

                  <div className="flex items-center min-h-control">
                    <input
                      type="checkbox"
                      id={`active_${ticket.id}`}
                      checked={ticket.isActive}
                      onChange={(e) => updateTicketType(index, { isActive: e.target.checked })}
                      className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <label htmlFor={`active_${ticket.id}`} className="ml-2.5 text-sm font-medium text-on-surface cursor-pointer">
                      Active (available for purchase)
                    </label>
                  </div>

                  <div>
                    <Input
                      type="datetime-local"
                      label="Sales Start (Optional)"
                      value={toLocalDateTimeInput(ticket.validFrom)}
                      onChange={(e) =>
                        updateTicketType(index, {
                          validFrom: e.target.value ? (new Date(e.target.value) as any) : undefined,
                        })
                      }
                      hint="Leave empty to start sales immediately"
                    />
                  </div>

                  <div>
                    <Input
                      type="datetime-local"
                      label="Sales Deadline (Optional)"
                      value={toLocalDateTimeInput(ticket.validUntil)}
                      onChange={(e) =>
                        updateTicketType(index, {
                          validUntil: e.target.value ? (new Date(e.target.value) as any) : undefined,
                        })
                      }
                      hint="Leave empty for no ticket-specific deadline"
                    />
                  </div>
                </div>

                {/* Benefits */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">Benefits (one per line)</label>
                  <textarea
                    value={ticket.benefits?.join('\n') || ''}
                    onChange={(e) => updateTicketType(index, {
                      benefits: e.target.value.split('\n').filter(b => b.trim())
                    })}
                    className="w-full px-3.5 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-on-surface"
                    rows={3}
                    placeholder="e.g.,&#10;Access to all sessions&#10;Lunch included&#10;Certificate of attendance"
                  />
                </div>
              </div>
            ))}
          </div>
        )}



        {/* Payment Configuration Section */}
      {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0) || (formData.paymentConfigs && formData.paymentConfigs.length > 0)) && (
        <div className="border-t pt-6 mt-6">
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-on-secondary-container">Payment Required Event</h4>
                <p className="text-sm text-primary mt-1">
                  Configure payment methods for attendees to complete their registration.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Only show pricing toggle if no tickets have prices */}
            {!formData.ticketTypes.some(ticket => ticket.price > 0) && (
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-4">Event Pricing</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isPaid: false, paymentConfigs: [] }))}
                    className={`p-4 border-2 rounded-lg text-center ${!formData.isPaid
                      ? 'border-green-500 bg-success-container text-success'
                      : 'border-outline-variant hover:border-outline'
                      }`}
                  >
                    <div className="font-medium">Free Event</div>
                    <div className="text-sm text-on-surface-variant">No payment required</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      isPaid: true,
                      paymentConfigs: prev.paymentConfigs && prev.paymentConfigs.length > 0 
                        ? prev.paymentConfigs 
                        : [createDefaultPaymentConfig('Primary Payment Method')]
                    }))}
                    className={`p-4 border-2 rounded-lg text-center ${formData.isPaid
                      ? 'border-primary bg-surface-container-low text-primary'
                      : 'border-outline-variant hover:border-outline'
                      }`}
                  >
                    <div className="font-medium">Paid Event</div>
                    <div className="text-sm text-on-surface-variant">Requires payment</div>
                  </button>
                </div>
              </div>
            )}
            

            {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0) || (formData.paymentConfigs && formData.paymentConfigs.length > 0)) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-on-surface">Currency</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Select
                      label="Event Currency"
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    >
                      <option value="PHP">PHP (Philippine Peso)</option>
                      <option value="USD">USD (US Dollar)</option>
                    </Select>
                  </div>
                </div>

                {/* Payment Configurations */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-on-surface flex items-center">
                      <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                      Payment Configurations
                    </h3>
                    <button
                      type="button"
                      onClick={addPaymentConfig}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Payment Method</span>
                    </button>
                  </div>

                  {(!formData.paymentConfigs || formData.paymentConfigs.length === 0) ? (
                    <div className="text-center py-8 bg-white border-2 border-dashed border-outline-variant rounded-lg">
                      <svg className="w-12 h-12 text-outline-variant mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01" />
                      </svg>
                      <h4 className="text-lg font-medium text-on-surface mb-2">No payment methods configured</h4>
                      <p className="text-on-surface-variant mb-4">Add payment methods to accept payments from attendees</p>
                      <button
                        type="button"
                        onClick={addPaymentConfig}
                        className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Your First Payment Method
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.paymentConfigs.map((config, index) => (
                        <div key={config.id} className="bg-white border border-outline-variant rounded-lg p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-secondary-container rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-medium text-on-surface">{config.name}</h4>
                                <p className="text-sm text-on-surface-variant">Payment Method #{index + 1}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => removePaymentConfig(index)}
                                className="p-2 text-error hover:bg-error-container rounded-lg"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-on-surface-variant mb-2">Payment Method Name</label>
                              <input
                                type="text"
                                value={config.name}
                                onChange={(e) => updatePaymentConfig(index, { name: e.target.value })}
                                className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                placeholder="e.g., GCash, Bank Transfer"
                              />
                            </div>
                          </div>

                          {/* Bank Details */}
                          <div className="mb-6">
                            <h4 className="font-medium text-on-surface mb-3">Bank/Payment Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-2">Bank/Service Name</label>
                                <input
                                  type="text"
                                  value={config.bankDetails.bankName}
                                  onChange={(e) => updatePaymentConfig(index, {
                                    bankDetails: { ...config.bankDetails, bankName: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                  placeholder="e.g., BDO, GCash, PayPal"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-2">Account Name</label>
                                <input
                                  type="text"
                                  value={config.bankDetails.accountName}
                                  onChange={(e) => updatePaymentConfig(index, {
                                    bankDetails: { ...config.bankDetails, accountName: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                  placeholder="Account holder name"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-2">Account Number</label>
                                <input
                                  type="text"
                                  value={config.bankDetails.accountNumber}
                                  onChange={(e) => updatePaymentConfig(index, {
                                    bankDetails: { ...config.bankDetails, accountNumber: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                  placeholder="Account/phone number"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Payment Instructions */}
                          <div className="mb-6">
                            <label className="block text-sm font-medium text-on-surface-variant mb-2">Payment Instructions</label>
                            <textarea
                              value={config.instructions}
                              onChange={(e) => updatePaymentConfig(index, { instructions: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                              placeholder="Provide detailed instructions for this payment method..."
                            />
                          </div>

                          {/* QR Code Upload */}
                          <div className="mb-6">
                            <label className="block text-sm font-medium text-on-surface-variant mb-2">QR Code (Optional)</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleQRCodeUploadForConfig(e, index)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {config.qrCodeUrl && (
                              <div className="mt-3">
                                <h6 className="font-medium text-gray-700 mb-2">Current QR Code</h6>
                                <img
                                  src={config.qrCodeUrl}
                                  alt="Payment QR Code"
                                  className="w-24 h-24 object-cover border border-gray-200 rounded"
                                />
                              </div>
                            )}
                          </div>

                          {/* Payment Options */}
                          <div className="border-t pt-4">
                            <h4 className="font-medium text-on-surface mb-3">Payment Verification Options</h4>
                            <div className="space-y-3">
                              <div className="flex items-center">
                                <input
                                  id={`requireProof_${index}`}
                                  type="checkbox"
                                  checked={true}
                                  disabled={true}
                                  className="h-4 w-4 text-primary border-outline-variant rounded focus:ring-primary opacity-50 cursor-not-allowed"
                                />
                                <label htmlFor={`requireProof_${index}`} className="ml-2 text-sm text-on-surface-variant">
                                  Require payment proof upload <span className="text-primary font-medium">(Always Required)</span>
                                </label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  id={`requireTransactionId_${index}`}
                                  type="checkbox"
                                  checked={true}
                                  disabled={true}
                                  className="h-4 w-4 text-primary border-outline-variant rounded focus:ring-primary opacity-50 cursor-not-allowed"
                                />
                                <label htmlFor={`requireTransactionId_${index}`} className="ml-2 text-sm text-on-surface-variant">
                                  Require transaction ID/reference number <span className="text-primary font-medium">(Always Required)</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    );
  };

  const renderRegistrationFormStep = () => {
    const handleFormChange = (newFields: FormField[]) => {
      setFormData(prev => ({
        ...prev,
        registrationForm: newFields
      }));
    };

    return (
      <div className="space-y-6">
        {/* Step-specific guidance box */}
        <div className="bg-primary-container border border-primary rounded-lg p-4" role="status">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-on-primary-container">
                Default form is ready to use!
              </h3>
              <div className="mt-1 text-sm text-primary">
                <p>
                  We've included name, email, and phone. You can customize or add more fields as needed.
                </p>
              </div>
            </div>
          </div>
        </div>

        <FormBuilder
          fields={formData.registrationForm}
          onChange={handleFormChange}
          title="Registration Form Builder"
          description="Design the registration form that attendees will fill out"
          showPreview={true}
        />

        {/* Additional guidance for form creation */}
        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4">
          <h4 className="font-medium text-on-secondary-container mb-2 flex items-center gap-1.5">
            <LightBulbIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Registration Form Tips</span>
          </h4>
          <ul className="text-sm text-on-secondary-container space-y-1">
            <li>• Keep required fields minimal to increase registration rates</li>
            <li>• Consider adding fields specific to your event (e.g., dietary restrictions, t-shirt size)</li>
            <li>• Use conditional fields to gather relevant information without overwhelming users</li>
            {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && <li>• Payment verification fields will be automatically added during registration</li>}
          </ul>
        </div>

        {/* Workflow Preview for Paid Events */}
        {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && formData.paymentConfigs && formData.paymentConfigs.length > 0 && (
          <div className="bg-success-container border border-outline-variant rounded-lg p-4">
            <h4 className="font-medium text-on-success-container mb-3 flex items-center gap-1.5">
              <ArrowPathIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Registration Workflow for Paid Events</span>
            </h4>
            <div className="space-y-3 text-sm text-on-success-container">
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-success text-white rounded-full flex items-center justify-center text-sm">1</span>
                <span>Attendee fills out registration form</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-success text-white rounded-full flex items-center justify-center text-sm">2</span>
                <span>Payment instructions and QR code are displayed</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-success text-white rounded-full flex items-center justify-center text-sm">3</span>
                <span>Attendee makes payment and uploads proof</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-success text-white rounded-full flex items-center justify-center text-sm">4</span>
                <span>Admin verifies payment and confirms registration</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-success text-white rounded-full flex items-center justify-center text-sm">5</span>
                <span>Attendee receives confirmation and event details</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReviewStep = () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-on-surface mb-4">Review Your Event</h3>
        <p className="text-on-surface-variant">Please review all information before publishing your event.</p>
      </div>

      {/* Event Summary */}
      <div className="bg-white border border-outline-variant rounded-lg p-6">
        <h4 className="font-semibold text-on-surface mb-4">Event Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-on-surface-variant">Title:</span>
            <span className="ml-2 text-on-surface">{formData.title}</span>
          </div>
          <div>
            <span className="font-medium text-on-surface-variant">Category:</span>
            <span className="ml-2 text-on-surface capitalize">{formData.category}</span>
          </div>
          <div>
            <span className="font-medium text-on-surface-variant">Date:</span>
            <span className="ml-2 text-on-surface">{formData.startDate} at {formData.startTime}</span>
          </div>
          <div>
            <span className="font-medium text-on-surface-variant">Venue:</span>
            <span className="ml-2 text-on-surface capitalize">{formData.venueType}</span>
          </div>
          <div>
            <span className="font-medium text-on-surface-variant">Ticket Types:</span>
            <span className="ml-2 text-on-surface">
              {formData.ticketTypes.length > 0 ?
                `${formData.ticketTypes.length} type${formData.ticketTypes.length > 1 ? 's' : ''}` :
                (formData.isPaid ? `₱${formData.ticketPrice}` : 'Free Event')
              }
            </span>
          </div>
          <div>
            <span className="font-medium text-on-surface-variant">Requirements:</span>
            <span className="ml-2 text-on-surface">
              {formData.requirements.length > 0 ? 
                `${formData.requirements.length} requirement${formData.requirements.length > 1 ? 's' : ''}` : 
                'None specified'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Ticket Types Summary */}
      {formData.ticketTypes.length > 0 && (
        <div className="bg-white border border-outline-variant rounded-lg p-6">
          <h4 className="font-semibold text-on-surface mb-4">Ticket Types</h4>
          <div className="space-y-4">
            {formData.ticketTypes.map((ticket, index) => (
              <div key={ticket.id} className="border border-outline-variant rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-on-surface">{ticket.name}</h5>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="font-medium text-on-surface">₱{ticket.price.toLocaleString()}</span>
                  </div>
                </div>
                {ticket.description && (
                  <p className="text-on-surface-variant text-sm mb-2">{ticket.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant">
                  <span>Max: {ticket.maxQuantity || 'Unlimited'}</span>
                  <span>{ticket.isActive ? 'Active' : 'Inactive'}</span>
                  {ticket.validUntil && toDateSafe(ticket.validUntil) && (
                    <span>
                      Deadline: {toDateSafe(ticket.validUntil)!.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  {ticket.benefits && ticket.benefits.length > 0 && (
                    <span>{ticket.benefits.length} benefit{ticket.benefits.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requirements Summary */}
      {formData.requirements.length > 0 && (
        <div className="bg-white border border-outline-variant rounded-lg p-6">
          <h4 className="font-semibold text-on-surface mb-4">Event Requirements</h4>
          <div className="space-y-2">
            {formData.requirements.map((requirement, index) => (
              <div key={index} className="flex items-center text-sm">
                <span className="w-4 h-4 rounded-full bg-surface-container-high text-primary text-sm flex items-center justify-center mr-2">
                  {index + 1}
                </span>
                <span className="text-on-surface">{requirement}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registration Form Summary */}
      <div className="bg-white border border-outline-variant rounded-lg p-6">
        <h4 className="font-semibold text-on-surface mb-4">Registration Form Fields</h4>
        <div className="space-y-2">
          {formData.registrationForm.map((field, index) => (
            <div key={field.id} className="flex items-center text-sm">
              <span className="w-4 h-4 rounded-full bg-secondary-container text-primary text-sm flex items-center justify-center mr-2">
                {index + 1}
              </span>
              <span className="text-on-surface">{field.label}</span>
              {field.required && <span className="text-error ml-1">*</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Payment Configuration Summary */}
      {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && formData.paymentConfigs && formData.paymentConfigs.length > 0 && (
        <div className="bg-white border border-outline-variant rounded-lg p-6">
          <h4 className="font-semibold text-on-surface mb-4">Payment Configurations ({formData.paymentConfigs.length})</h4>
          <div className="space-y-4">
            {formData.paymentConfigs.map((config, index) => (
              <div key={config.id} className="border border-outline-variant rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-on-surface">{config.name}</h5>
                  <span className={`px-2 py-1 text-sm rounded-full ${config.isActive ? 'bg-success-container text-on-success-container' : 'bg-surface-container text-on-surface'}`}>
                    {config.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h6 className="font-medium text-on-surface-variant mb-2">Bank Details</h6>
                    <div className="space-y-1 text-sm text-on-surface-variant">
                      <div>Bank: {config.bankDetails.bankName || '-'}</div>
                      <div>Account: {config.bankDetails.accountName || '-'}</div>
                      <div>Number: {config.bankDetails.accountNumber || '-'}</div>
                    </div>
                  </div>
                  <div>
                    <h6 className="font-medium text-on-surface-variant mb-2">Verification Settings</h6>
                    <div className="space-y-1 text-sm text-on-surface-variant">
                      <div>Screenshot Required: {config.requiresProof ? 'Yes' : 'No'}</div>
                      <div>Transaction ID: {config.requiresTransactionId ? 'Required' : 'Optional'}</div>
                      <div>Additional Fields: {config.paymentFields?.length || 0}</div>
                    </div>
                  </div>
                </div>
                {config.qrCodeUrl && (
                  <div className="mt-3">
                    <h6 className="font-medium text-on-surface-variant mb-2">QR Code</h6>
                    <img
                      src={config.qrCodeUrl}
                      alt="Payment QR Code"
                      className="w-24 h-24 object-cover border border-outline-variant rounded"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publish Actions */}
      <div className="bg-gradient-to-r from-surface-container-low to-success-container border border-outline-variant rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold text-on-surface">
              {formData.status === 'published' || (isEditMode && formData.status && formData.status !== 'draft')
                ? 'Ready to Update?'
                : 'Ready to Publish?'}
            </h4>
            <p className="text-on-surface-variant mt-1 text-sm">
              {formData.status === 'published' || (isEditMode && formData.status && formData.status !== 'draft')
                ? 'Your event is live. Changes will be saved and visible to attendees immediately.'
                : 'Publish your event to make it live for attendee registrations, or save as a draft to continue editing later.'
              }
            </p>
            {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && (
              <p className="text-sm text-primary mt-2 font-medium flex items-center gap-1.5">
                <ClipboardDocumentCheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Registration will require payment verification before confirmation</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {formData.status === 'published' || (isEditMode && formData.status && formData.status !== 'draft') ? (
              <Button
                variant="filled"
                onClick={() => handleSaveEvent(false)}
                disabled={loading || authLoading || isSubmitting}
                loading={isSubmitting}
              >
                Update Event
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  onClick={() => handleSaveEvent(false)}
                  disabled={loading || authLoading || isSubmitting}
                  loading={isSubmitting}
                >
                  Save as Draft
                </Button>
                <Button
                  variant="filled"
                  onClick={() => handleSaveEvent(true)}
                  disabled={loading || authLoading || isSubmitting}
                  loading={isSubmitting}
                >
                  Publish Event
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Final Workflow Summary */}
        {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && (
          <div className="mt-4 pt-4 border-t border-outline-variant">
            <h5 className="font-medium text-on-surface mb-2">Event Registration Flow</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-on-surface-variant">
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center text-sm">1</span>
                <span>Attendee Registration ({formData.registrationForm.length} fields)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 bg-warning text-white rounded-full flex items-center justify-center text-sm">2</span>
                <span>Payment & Verification ({formData.paymentConfigs?.reduce((total, config) => total + (config.paymentFields?.length || 0), 0) || 0} fields)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Main component render
  const editorContent = (
    <div className="pt-1 pb-8">
      {/* Breadcrumb Navigation Strip */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant mb-6 bg-white px-4 py-3 rounded-xl border border-outline-variant shadow-sm">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary-hover font-medium transition-colors"
          >
            <CalendarDaysIcon className="h-4 w-4 text-outline-variant" />
            <span>Events</span>
          </Link>
          <span className="text-outline-variant">/</span>
          {isEditMode && targetEventId ? (
            <>
              <Link
                to={`/events/${targetEventId}`}
                className="text-on-surface-variant hover:text-primary-hover font-medium truncate max-w-xs transition-colors"
                title={formData.title || 'Event Details'}
              >
                {formData.title || 'Event Details'}
              </Link>
              <span className="text-outline-variant">/</span>
              <span className="text-primary font-semibold bg-primary-container px-2 py-0.5 rounded text-xs">
                Edit
              </span>
            </>
          ) : (
            <span className="text-primary font-semibold bg-primary-container px-2 py-0.5 rounded text-xs">
              Create Event
            </span>
          )}
        </nav>

      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Sidebar - Step Navigation */}
        <div className="lg:col-span-3 xl:col-span-2 2xl:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-outline-variant p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-on-surface mb-4">
              {isEditMode ? 'Edit Event' : 'Create New Event'}
            </h3>
            <nav className="space-y-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(index)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors min-h-[44px] ${
                      isCurrent
                        ? 'bg-primary-container text-primary border border-outline-variant'
                        : isCompleted
                        ? 'text-success hover:bg-success-container'
                        : 'text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                      isCurrent
                        ? 'bg-primary text-white'
                        : isCompleted
                        ? 'bg-success text-white'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {isCompleted ? (
                        <CheckCircleIcon className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        isCurrent ? 'text-primary-900 font-semibold' : isCompleted ? 'text-on-success-container' : 'text-on-surface'
                      }`}>
                        {step.title}
                      </div>
                    </div>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${
                      isCurrent ? 'text-primary' : isCompleted ? 'text-success' : 'text-outline-variant'
                    }`} />
                  </button>
                );
              })}
            </nav>

            {/* Progress */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm text-on-surface-variant mb-2">
                <span>Progress</span>
                <span className="font-medium">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
              </div>
              <ProgressBar
                value={((currentStep + 1) / steps.length) * 100}
                size="sm"
                color="bg-primary-600"
                label={`Step ${currentStep + 1} of ${steps.length}`}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-9 xl:col-span-10 2xl:col-span-10 mt-6 lg:mt-0">
          <div className="bg-white rounded-lg shadow-sm border border-outline-variant">
            <div className="px-6 py-4 border-b border-outline-variant">
              <div>
                <h2 className="text-xl font-semibold text-on-surface">
                  {steps[currentStep].title}
                </h2>
                <p className="text-on-surface-variant mt-1 text-sm">
                  {isEditMode ? 'Edit Event' : 'Create New Event'} — Step {currentStep + 1} of {steps.length}
                </p>
              </div>
            </div>

            <div className={currentStep === 4 ? "p-3 sm:p-5" : "px-6 py-6"}>
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2 text-on-surface-variant">Loading event data...</span>
                </div>
              )}
              
              {!loading && (
                <div className={currentStep === 4 ? "w-full" : "max-w-4xl"}>
                  {renderStepContent()}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="text"
                  onClick={() => {
                    if (isEditMode && targetEventId) {
                      navigate(`/events/${targetEventId}`);
                    } else {
                      navigate('/events');
                    }
                  }}
                  disabled={loading || isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0 || loading || isSubmitting}
                >
                  Previous
                </Button>
              </div>
              <div className="flex items-center gap-3">
                {currentStep < steps.length - 1 ? (
                  <>
                    {isEditMode && (
                      <Button
                        variant="tonal"
                        onClick={() => handleSaveEvent(false)}
                        disabled={loading || authLoading || isSubmitting}
                        loading={isSubmitting}
                      >
                        Save Changes
                      </Button>
                    )}
                    <Button
                      variant="filled"
                      onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                      disabled={loading || isSubmitting}
                    >
                      Next
                    </Button>
                  </>
                ) : formData.status === 'published' || (isEditMode && formData.status && formData.status !== 'draft') ? (
                  <Button
                    variant="filled"
                    onClick={() => handleSaveEvent(false)}
                    disabled={loading || authLoading || isSubmitting}
                    loading={isSubmitting}
                  >
                    Update Event
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="tonal"
                      onClick={() => handleSaveEvent(false)}
                      disabled={loading || authLoading || isSubmitting}
                      loading={isSubmitting}
                    >
                      Save as Draft
                    </Button>
                    <Button
                      variant="filled"
                      onClick={() => handleSaveEvent(true)}
                      disabled={loading || authLoading || isSubmitting}
                      loading={isSubmitting}
                    >
                      Publish Event
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell
      title={isEditMode ? 'Edit Event' : 'Create New Event'}
      subtitle={
        isEditMode
          ? (formData.title ? `Editing "${formData.title}"` : 'Update event details, schedule, tickets, and forms')
          : 'Set up event details, venue, ticket types, and custom forms'
      }
      fullWidth={true}
      actions={
        <div className="flex items-center gap-2 sm:gap-3">
          {isEditMode && targetEventId ? (
            <>
              <Link
                to={`/events/${targetEventId}`}
                className="inline-flex min-h-control items-center gap-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Back to Event Details"
              >
                <ArrowLeftIcon className="h-4 w-4 text-on-surface-variant" />
                <span>Back to Event Details</span>
              </Link>
              <Button
                variant="filled"
                size="sm"
                onClick={() => handleSaveEvent(false)}
                disabled={loading || authLoading || isSubmitting}
                loading={isSubmitting}
              >
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/events"
                className="inline-flex min-h-control items-center gap-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Back to Events"
              >
                <ArrowLeftIcon className="h-4 w-4 text-on-surface-variant" />
                <span>Back to Events</span>
              </Link>
              <Button
                variant="tonal"
                size="sm"
                onClick={() => handleSaveEvent(false)}
                disabled={loading || authLoading || isSubmitting}
                loading={isSubmitting}
              >
                Save as Draft
              </Button>
            </>
          )}
        </div>
      }
    >
      {editorContent}
    </AppShell>
  );
};

// No role check of its own: /events/create and /events/edit/:eventId are gated on
// `read 'all'` in App.tsx, which only admins hold. The rule used to be enforced
// twice inside this page as well - a redirect effect plus a `return null`.
export default EventEditorPage;


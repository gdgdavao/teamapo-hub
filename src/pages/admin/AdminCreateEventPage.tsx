import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { functions } from '../../config/firebase';
import EventService from '../../services/eventService';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PhotoIcon,
  CheckCircleIcon,
  TicketIcon,
  TagIcon,
  ArrowLeftIcon,
  UserIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { FormBuilder, FormField } from '../../components/shared/FormBuilder';
import { PhotoUpload } from '../../components/shared';
import { TicketType, PromoCode } from '../../types';
import PromoCodeManager from '../../components/public/PromoCodeManager';

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

  // Speakers (as per PRD requirement)
  speakers: {
    id: string;
    name: string;
    title: string;
    company?: string;
    bio: string;
    photoUrl?: string;
  }[];

  // Pricing & Tickets
  ticketTypes: TicketType[];
  promoCodes: PromoCode[];

  // Legacy pricing (for backward compatibility)
  isPaid: boolean;
  ticketPrice: number;
  currency: string;
  maxAttendees?: number;

  // Forms
  registrationForm: FormField[];
  feedbackForm: FormField[];

  // Payment (for paid events)
  paymentConfigs?: PaymentConfig[];

  // Settings
  category: string;
  tags: string[];
  requirements: string[];
  registrationDeadline?: string;
}

const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, loading: authLoading } = useAuth();

  // This page is now admin-only
  const isEditMode = location.pathname.includes('/edit/');

  // Redirect non-admin users to dashboard
  useEffect(() => {
    if (!authLoading && userProfile && userProfile.role !== 'admin') {
      toast.error('Only administrators can create and edit events');
      navigate('/dashboard');
    }
  }, [authLoading, userProfile, navigate]);

  // Don't render the component if user is not admin
  if (authLoading) {
    return <div>Loading...</div>;
  }

  if (!userProfile || userProfile.role !== 'admin') {
    return null; // Will redirect via useEffect
  }

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [speakerPhotoFiles, setSpeakerPhotoFiles] = useState<{ [speakerId: string]: File }>({});

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

    // Speakers
    speakers: [],

    // New ticket system
    ticketTypes: [],
    promoCodes: [],

    // Legacy pricing (for backward compatibility)
    isPaid: false,
    ticketPrice: 0,
    currency: 'PHP',
    registrationForm: [
      { id: '1', type: 'text', label: 'Full Name', required: true, gridSize: 'full' },
      { id: '2', type: 'email', label: 'Email Address', required: true, gridSize: 'half' },
      { id: '3', type: 'phone', label: 'Phone Number', required: true, gridSize: 'half' }
    ],
    feedbackForm: [
      { id: '1', type: 'rating', label: 'Overall Event Rating', required: true, gridSize: 'full' },
      { id: '2', type: 'textarea', label: 'What did you like most?', required: false, gridSize: 'full' },
      { id: '3', type: 'textarea', label: 'Areas for improvement', required: false, gridSize: 'full' }
    ],
    category: 'workshop',
    tags: [],
    requirements: [],
    paymentConfigs: []
  });

  const [activeFormType, setActiveFormType] = useState<'registration' | 'feedback'>('registration');

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
    if (isEditMode) {
      const eventIdFromUrl = location.pathname.split('/').pop();
      if (eventIdFromUrl) {
        loadEventData(eventIdFromUrl);
      }
    }
  }, [isEditMode, location.pathname]);

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
    } else if (!hasPaidTickets && formData.isPaid) {
      setFormData(prev => ({
        ...prev,
        isPaid: false,
        paymentConfigs: []
      }));
    }
  }, [formData.ticketTypes]);

  // Helper function to safely convert Firestore timestamps to Date objects
  const convertTimestampToDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      // Firestore Timestamp object
      return timestamp.toDate();
    } else if (timestamp?.seconds && typeof timestamp.seconds === 'number') {
      // Firestore timestamp as plain object (from Firestore emulator or client)
      return new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      // Regular Date object
      return timestamp;
    } else if (typeof timestamp === 'string') {
      // Date string
      return new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Unix timestamp
      return new Date(timestamp);
    } else {
      // Try to create a Date object
      return new Date(timestamp);
    }
  };

  const loadEventData = async (eventId: string) => {
    try {
      setLoading(true);
      const event = await EventService.getEvent(eventId);
      if (event) {
        setEventId(eventId);
        
        // Safely convert dates
        const startDate = convertTimestampToDate(event.startDate);
        const endDate = convertTimestampToDate(event.endDate);
        const registrationDeadline = event.registrationDeadline ? convertTimestampToDate(event.registrationDeadline) : null;
        
        // Load forms separately
        const [registrationForm, feedbackForm] = await Promise.all([
          EventService.getEventRegistrationForm(eventId),
          EventService.getEventFeedbackForm(eventId)
        ]);
        
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
          speakers: event.speakers || [],
          ticketTypes: event.ticketTypes,
          promoCodes: event.promoCodes || [],
          isPaid: event.ticketTypes.some(ticket => ticket.price > 0),
          ticketPrice: event.ticketTypes[0]?.price || 0,
          currency: event.ticketTypes[0]?.currency || 'PHP',
          maxAttendees: event.maxAttendees,
          registrationForm: registrationForm,
          feedbackForm: feedbackForm,
          category: event.category,
          tags: event.tags,
          requirements: event.requirements || [],
          registrationDeadline: registrationDeadline?.toISOString().split('T')[0]
        };
        setFormData(eventFormData);
      }
    } catch (error) {
      toast.error('Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  const handleShareEvent = (eventId: string, eventTitle: string) => {
    const shareUrl = `${window.location.origin}/events/${eventId}/register`;
    
    // Copy link to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success(`Registration link for "${eventTitle}" copied to clipboard!`, {
        duration: 4000,
        icon: '🔗'
      });
    }).catch(() => {
      toast.error('Failed to copy link to clipboard');
    });
  };

  const handleSaveEvent = async (publish: boolean = false) => {
    // Wait for auth to be fully initialized
    if (authLoading) {
      toast.error('Please wait for authentication to complete');
      return;
    }
    
    if (!currentUser) {
      toast.error('You must be logged in to create an event');
      return;
    }

    let toastId: string | undefined;
    try {
      setLoading(true);

      // Client-side validation first
      if (!formData.title || !formData.description || !formData.startDate || !formData.startTime) {
        toast.error('Please fill in all required fields');
        setLoading(false);
        return;
      }

      // Ensure auth token is fresh before making function calls
      try {
        await currentUser.getIdToken(true); // Force token refresh
        
        // Check if user document exists in Firestore
        if (!userProfile) {
          toast.error('User profile not found. Please sign out and sign in again.');
          setLoading(false);
          return;
        }
      } catch (authError) {
        toast.error('Authentication expired. Please sign in again.');
        setLoading(false);
        return;
      }

      // Server-side validation via callable function with fallback to client-side checks
      try {
        const validateEventData = httpsCallable(functions, 'validate_event_data');
        const validation: any = await validateEventData({ eventData: formData });
        if (!validation?.data?.isValid) {
          const errs = validation?.data?.errors || ['Validation failed'];
          toast.error(errs.join(', '));
          setLoading(false);
          return;
        }
      } catch (_fnErr) {
        // fall back to simple local checks below
      }
      
      // Basic client-side validation (keeping it simple for now as a fallback)
      if (!formData.title.trim()) {
        toast.error('Event title is required');
        setLoading(false);
        return;
      }
      
      if (!formData.description.trim()) {
        toast.error('Event description is required');
        setLoading(false);
        return;
      }

      // Validate dates
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      
      if (startDateTime < new Date()) {
        toast.error('Event start date must be in the future');
        setLoading(false);
        return;
      }
      
      if (endDateTime <= startDateTime) {
        toast.error('Event end date must be after start date');
        setLoading(false);
        return;
      }

      // Centralized notifications
      toastId = toast.loading(
        publish
          ? (isEditMode ? 'Publishing event…' : 'Creating and publishing event…')
          : (isEditMode ? 'Updating event…' : 'Creating event…')
      );
      const warnings: string[] = [];

      let savedEventId: string;

      // Create or update event first (without base64 image data or base64 speaker photoUrl previews)
      const eventDataWithoutBase64Image = {
        ...formData,
        imageUrl: formData.imageUrl && formData.imageUrl.startsWith('data:') ? undefined : formData.imageUrl,
        speakers: (formData.speakers || []).map((s) => ({
          ...s,
          photoUrl: s.photoUrl && s.photoUrl.startsWith('data:') ? undefined : s.photoUrl
        }))
      };

      if (isEditMode && eventId) {
        // Update existing event
        await EventService.updateEvent(eventId, eventDataWithoutBase64Image);
        savedEventId = eventId;
      } else {
        // Create new event
        savedEventId = await EventService.createEvent(eventDataWithoutBase64Image, currentUser.uid);
        setEventId(savedEventId);
      }

      // Upload event image if provided (after event is created)
      if (formData.imageUrl && formData.imageUrl.startsWith('data:')) {
        try {
          // Convert data URL to blob and then to file
          const response = await fetch(formData.imageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'event-image.jpg', { type: 'image/jpeg' });
          
          // Upload image to Firebase Storage (this will also update the event with the image URL)
          await EventService.uploadEventImage(savedEventId, file);
        } catch (error) {
          warnings.push('Event image upload failed');
        }
      }

      // Upload payment QR codes if provided
      if (formData.paymentConfigs && formData.paymentConfigs.length > 0) {
        const updatedPaymentConfigs = [...formData.paymentConfigs];
        
        for (let i = 0; i < updatedPaymentConfigs.length; i++) {
          const config = updatedPaymentConfigs[i];
          if (config.qrCodeImage) {
            try {
              const qrCodeUrl = await EventService.uploadPaymentQR(savedEventId, config.qrCodeImage);
              updatedPaymentConfigs[i] = {
                ...config,
                qrCodeUrl
              };
            } catch (error) {
              warnings.push(`Payment QR upload failed for ${config.name}`);
            }
          }
        }
        
        // Update event with all payment configs
        await EventService.updateEvent(savedEventId, {
          paymentConfigs: updatedPaymentConfigs // Use all payment configs
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

      // Publish event if requested
      if (publish) {
        try {
          await EventService.publishEvent(savedEventId);
        } catch (error) {
          warnings.push('Publishing failed');
        }
      }

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
        ? (publish ? 'Event updated and published.' : 'Event updated as draft.')
        : (publish ? 'Event created and published.' : 'Event saved as draft.');
      const finalMessage = warnings.length > 0
        ? `${baseMessage} Note: ${warnings.join('; ')}.`
        : baseMessage;
      toast.success(finalMessage, { id: toastId });

      // Navigate to the appropriate page based on context and publish status
      // Add a small delay to ensure the user sees the success message
      setTimeout(() => {
        // Since only admins can create events, always navigate to admin dashboard
        navigate('/admin/dashboard');
      }, 1500); // 1.5 second delay to show success message

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
      setLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          imageUrl: e.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
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
    { id: 4, title: 'Promo Codes', icon: TagIcon },
    { id: 5, title: 'Registration Form', icon: UserGroupIcon },
    { id: 6, title: 'Feedback Form', icon: ChatBubbleLeftRightIcon },
    { id: 7, title: 'Review & Publish', icon: CheckCircleIcon }
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
        return renderPromoCodeStep();
      case 5:
        return renderFormBuilderStep('registration');
      case 6:
        return renderFormBuilderStep('feedback');
      case 7:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const renderBasicInfoStep = () => (
    <div className="space-y-6">

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter event title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Short Description</label>
        <input
          type="text"
          value={formData.shortDescription}
          onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Brief description for event cards"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Full Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Detailed event description"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Event Image</label>
        <div className="flex items-center space-x-4">
          {formData.imageUrl ? (
            <div className="relative">
              <img
                src={formData.imageUrl}
                alt="Event preview"
                className="w-32 h-32 object-cover rounded-lg border border-gray-300"
              />
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, imageUrl: undefined }))}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
              <PhotoIcon className="w-8 h-8 text-gray-400" />
              <span className="mt-2 text-sm text-gray-500">Upload Image</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </label>
          )}
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              Upload an attractive event image to help draw attendees. 
              Recommended size: 1200x630 pixels (16:9 ratio).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="workshop">Workshop</option>
            <option value="meetup">Meetup</option>
            <option value="conference">Conference</option>
            <option value="hackathon">Hackathon</option>
            <option value="networking">Networking</option>
            <option value="webinar">Webinar</option>
            <option value="study-jam">Study Jam</option>
            <option value="code-lab">Code Lab</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max Attendees</label>
          <input
            type="number"
            value={formData.maxAttendees || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, maxAttendees: e.target.value ? parseInt(e.target.value) : undefined }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Event Requirements</label>
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter requirement (e.g., Laptop required, Basic Python knowledge)"
              />
              <button
                type="button"
                onClick={() => {
                  const newRequirements = formData.requirements.filter((_, i) => i !== index);
                  setFormData(prev => ({ ...prev, requirements: newRequirements }));
                }}
                className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, requirements: [...prev.requirements, ''] }))}
            className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
          >
            + Add Requirement
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          List any requirements or prerequisites for attendees (e.g., "Laptop required", "Basic Python knowledge")
        </p>
      </div>
    </div>
  );

  const renderDateVenueStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Venue Type</label>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'On-Site' },
            { value: 'hybrid', label: 'Hybrid' }
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, venueType: value as any }))}
              className={`p-4 border-2 rounded-lg text-center ${formData.venueType === value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
                }`}
            >
              <div className="font-medium">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {formData.venueType !== 'online' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Venue Name</label>
            <input
              type="text"
              value={formData.venueName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, venueName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter venue name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter city"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={formData.venueAddress || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, venueAddress: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter full address"
            />
          </div>
        </div>
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
            <h3 className="text-lg font-semibold text-gray-900">Speaker Profiles</h3>
            <p className="text-gray-600">Add speakers to highlight at your event</p>
          </div>
          <button
            type="button"
            onClick={addSpeaker}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Speaker</span>
          </button>
        </div>

        {formData.speakers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No speakers yet</h3>
            <p className="text-gray-600 mb-4">Add your first speaker to get started</p>
            <button
              type="button"
              onClick={addSpeaker}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Speaker
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {formData.speakers.map((speaker, index) => (
              <div key={speaker.id} className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">
                    Speaker {index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeSpeaker(index)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={speaker.name}
                      onChange={(e) => updateSpeaker(index, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Speaker's full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title/Role *</label>
                    <input
                      type="text"
                      value={speaker.title}
                      onChange={(e) => updateSpeaker(index, { title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Senior Developer, CTO"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    <input
                      type="text"
                      value={speaker.company || ''}
                      onChange={(e) => updateSpeaker(index, { company: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Company name"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Speaker Photo</label>
                    <PhotoUpload
                      currentPhotoUrl={speaker.photoUrl}
                      onPhotoChange={(file, previewUrl) => handleSpeakerPhotoChange(speaker.id, file, previewUrl)}
                      onPhotoRemove={() => handleSpeakerPhotoRemove(speaker.id)}
                      placeholder="Upload Photo"
                      maxSize={5}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio *</label>
                    <textarea
                      value={speaker.bio}
                      onChange={(e) => updateSpeaker(index, { bio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <h3 className="text-lg font-semibold text-gray-900">Ticket Types</h3>
            <p className="text-gray-600">Configure different ticket types and pricing for your event</p>
          </div>
          <button
            type="button"
            onClick={addTicketType}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Ticket Type</span>
          </button>
        </div>

        {formData.ticketTypes.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <TicketIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No ticket types yet</h3>
            <p className="text-gray-600 mb-4">Create your first ticket type to get started</p>
            <button
              type="button"
              onClick={addTicketType}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Ticket Type
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {formData.ticketTypes.map((ticket, index) => (
              <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Ticket Type {index + 1}</h4>
                  <div className="flex items-center space-x-2">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => moveTicketType(index, 'up')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <ArrowUpIcon className="w-4 h-4" />
                      </button>
                    )}
                    {index < formData.ticketTypes.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveTicketType(index, 'down')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <ArrowDownIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTicketType(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={ticket.name}
                      onChange={(e) => updateTicketType(index, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., General Admission, VIP, Student"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱) *</label>
                    <input
                      type="number"
                      value={ticket.price ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateTicketType(index, { price: (val === '' ? (undefined as any) : parseFloat(val)) });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={ticket.description || ''}
                      onChange={(e) => updateTicketType(index, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      placeholder="Brief description of this ticket type"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Quantity</label>
                    <input
                      type="number"
                      value={ticket.maxQuantity || ''}
                      onChange={(e) => updateTicketType(index, {
                        maxQuantity: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      placeholder="Unlimited"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`active_${ticket.id}`}
                      checked={ticket.isActive}
                      onChange={(e) => updateTicketType(index, { isActive: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`active_${ticket.id}`} className="ml-2 text-sm text-gray-700">
                      Active (available for purchase)
                    </label>
                  </div>
                </div>


                {/* Benefits */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Benefits (one per line)</label>
                  <textarea
                    value={ticket.benefits?.join('\n') || ''}
                    onChange={(e) => updateTicketType(index, {
                      benefits: e.target.value.split('\n').filter(b => b.trim())
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="e.g.,&#10;Access to all sessions&#10;Lunch included&#10;Certificate of attendance"
                  />
                </div>
              </div>
            ))}
          </div>
        )}



        {/* Payment Configuration Section */}
      {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && (
        <div className="border-t pt-6 mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-900">Payment Required Event</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Configure payment methods for attendees to complete their registration.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Only show pricing toggle if no tickets have prices */}
            {!formData.ticketTypes.some(ticket => ticket.price > 0) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Event Pricing</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isPaid: false, paymentConfigs: [] }))}
                    className={`p-4 border-2 rounded-lg text-center ${!formData.isPaid
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 hover:border-gray-400'
                      }`}
                  >
                    <div className="font-medium">Free Event</div>
                    <div className="text-sm text-gray-500">No payment required</div>
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
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                      }`}
                  >
                    <div className="font-medium">Paid Event</div>
                    <div className="text-sm text-gray-500">Requires payment</div>
                  </button>
                </div>
              </div>
            )}
            

            {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Currency</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Event Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="PHP">PHP (Philippine Peso)</option>
                      <option value="USD">USD (US Dollar)</option>
                    </select>
                  </div>
                </div>

                {/* Payment Configurations */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                      Payment Configurations
                    </h3>
                    <button
                      type="button"
                      onClick={addPaymentConfig}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Payment Method</span>
                    </button>
                  </div>

                  {(!formData.paymentConfigs || formData.paymentConfigs.length === 0) ? (
                    <div className="text-center py-8 bg-white border-2 border-dashed border-gray-300 rounded-lg">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01M12 12h4.01" />
                      </svg>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No payment methods configured</h4>
                      <p className="text-gray-600 mb-4">Add payment methods to accept payments from attendees</p>
                      <button
                        type="button"
                        onClick={addPaymentConfig}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                        <div key={config.id} className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{config.name}</h4>
                                <p className="text-sm text-gray-500">Payment Method #{index + 1}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => removePaymentConfig(index)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method Name</label>
                              <input
                                type="text"
                                value={config.name}
                                onChange={(e) => updatePaymentConfig(index, { name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., GCash, Bank Transfer"
                              />
                            </div>
                          </div>

                          {/* Bank Details */}
                          <div className="mb-6">
                            <h4 className="font-medium text-gray-900 mb-3">Bank/Payment Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Bank/Service Name</label>
                                <input
                                  type="text"
                                  value={config.bankDetails.bankName}
                                  onChange={(e) => updatePaymentConfig(index, {
                                    bankDetails: { ...config.bankDetails, bankName: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="e.g., BDO, GCash, PayPal"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                                <input
                                  type="text"
                                  value={config.bankDetails.accountName}
                                  onChange={(e) => updatePaymentConfig(index, {
                                    bankDetails: { ...config.bankDetails, accountName: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Account holder name"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                                <input
                                  type="text"
                                  value={config.bankDetails.accountNumber}
                                  onChange={(e) => updatePaymentConfig(index, {
                                    bankDetails: { ...config.bankDetails, accountNumber: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Account/phone number"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Payment Instructions */}
                          <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Instructions</label>
                            <textarea
                              value={config.instructions}
                              onChange={(e) => updatePaymentConfig(index, { instructions: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Provide detailed instructions for this payment method..."
                            />
                          </div>

                          {/* QR Code Upload */}
                          <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">QR Code (Optional)</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  updatePaymentConfig(index, { qrCodeImage: file });
                                }
                              }}
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
                            <h4 className="font-medium text-gray-900 mb-3">Payment Verification Options</h4>
                            <div className="space-y-3">
                              <div className="flex items-center">
                                <input
                                  id={`requireProof_${index}`}
                                  type="checkbox"
                                  checked={true}
                                  disabled={true}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 opacity-50 cursor-not-allowed"
                                />
                                <label htmlFor={`requireProof_${index}`} className="ml-2 text-sm text-gray-700">
                                  Require payment proof upload <span className="text-blue-600 font-medium">(Always Required)</span>
                                </label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  id={`requireTransactionId_${index}`}
                                  type="checkbox"
                                  checked={true}
                                  disabled={true}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 opacity-50 cursor-not-allowed"
                                />
                                <label htmlFor={`requireTransactionId_${index}`} className="ml-2 text-sm text-gray-700">
                                  Require transaction ID/reference number <span className="text-blue-600 font-medium">(Always Required)</span>
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

  const renderPromoCodeStep = () => {
    const handleCreatePromoCode = (promoCodeData: Omit<PromoCode, 'id' | 'currentUses' | 'createdAt' | 'updatedAt'>) => {
      const newPromoCode: PromoCode = {
        ...promoCodeData,
        id: `promo_${Date.now()}`,
        currentUses: 0,
        createdAt: { toDate: () => new Date() } as any,
        updatedAt: { toDate: () => new Date() } as any
      };

      setFormData(prev => ({
        ...prev,
        promoCodes: [...prev.promoCodes, newPromoCode]
      }));
    };

    const handleUpdatePromoCode = (id: string, updates: Partial<PromoCode>) => {
      setFormData(prev => ({
        ...prev,
        promoCodes: prev.promoCodes.map(promo =>
          promo.id === id ? { ...promo, ...updates, updatedAt: { toDate: () => new Date() } as any } : promo
        )
      }));
    };

    const handleDeletePromoCode = (id: string) => {
      setFormData(prev => ({
        ...prev,
        promoCodes: prev.promoCodes.filter(promo => promo.id !== id)
      }));
    };

    return (
      <div className="space-y-6">
        {/* Step-specific guidance box */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TagIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                This step is completely optional
              </h3>
              <div className="mt-1 text-sm text-yellow-700">
                <p>Promo codes can boost registrations but aren't required. You can always add them later from your event dashboard.</p>
              </div>
            </div>
          </div>
        </div>

        <PromoCodeManager
          eventId="new-event" // This will be replaced with actual event ID after creation
          promoCodes={formData.promoCodes}
          ticketTypes={formData.ticketTypes}
          onCreatePromoCode={handleCreatePromoCode}
          onUpdatePromoCode={handleUpdatePromoCode}
          onDeletePromoCode={handleDeletePromoCode}
        />

        {formData.ticketTypes.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              💡 <strong>Tip:</strong> Create ticket types first before adding promo codes.
              Promo codes can be configured to apply to specific ticket types.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderFormBuilderStep = (formType: 'registration' | 'feedback') => {
    const fields = formType === 'registration' ? formData.registrationForm : formData.feedbackForm;
    const title = formType === 'registration' ? 'Registration Form Builder' : 'Feedback Form Builder';
    const description = `Design the ${formType} form that attendees will fill out`;

    const handleFormChange = (newFields: FormField[]) => {
      setFormData(prev => ({
        ...prev,
        [formType === 'registration' ? 'registrationForm' : 'feedbackForm']: newFields
      }));
    };

    return (
      <div className="space-y-6">
        {/* Step-specific guidance box */}
        <div className={`${formType === 'registration' ? 'bg-purple-50 border-l-4 border-purple-400' : 'bg-orange-50 border-l-4 border-orange-400'} p-4 rounded-r-lg`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {formType === 'registration' ? (
                <UserGroupIcon className="h-5 w-5 text-purple-400" />
              ) : (
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-orange-400" />
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${formType === 'registration' ? 'text-purple-800' : 'text-orange-800'}`}>
                {formType === 'registration' ? 'Default form is ready to use!' : 'Feedback form is set up with essentials!'}
              </h3>
              <div className={`mt-1 text-sm ${formType === 'registration' ? 'text-purple-700' : 'text-orange-700'}`}>
                <p>
                  {formType === 'registration'
                    ? 'We\'ve included name, email, and phone. You can customize or add more fields as needed.'
                    : 'Basic feedback fields are included. Feel free to customize for your specific event needs.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <FormBuilder
          fields={fields}
          onChange={handleFormChange}
          title={title}
          description={description}
          showPreview={true}
        />

        {/* Additional guidance for form creation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            💡 {formType === 'registration' ? 'Registration' : 'Feedback'} Form Tips
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {formType === 'registration' ? (
              <>
                <li>• Keep required fields minimal to increase registration rates</li>
                <li>• Consider adding fields specific to your event (e.g., dietary restrictions, t-shirt size)</li>
                <li>• Use conditional fields to gather relevant information without overwhelming users</li>
                {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && <li>• Payment verification fields will be automatically added during registration</li>}
              </>
            ) : (
              <>
                <li>• Include both rating and open-ended questions for comprehensive feedback</li>
                <li>• Ask about specific aspects like content, speakers, venue, and organization</li>
                <li>• Keep the form concise - attendees are more likely to complete shorter forms</li>
                <li>• Consider adding fields for suggestions and future event topics</li>
              </>
            )}
          </ul>
        </div>

        {/* Workflow Preview for Paid Events */}
        {formType === 'registration' && (formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && formData.paymentConfigs && formData.paymentConfigs.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-3">
              🔄 Registration Workflow for Paid Events
            </h4>
            <div className="space-y-3 text-sm text-green-800">
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                <span>Attendee fills out registration form</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                <span>Payment instructions and QR code are displayed</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                <span>Attendee makes payment and uploads proof</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">4</span>
                <span>Admin verifies payment and confirms registration</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">5</span>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Your Event</h3>
        <p className="text-gray-600">Please review all information before publishing your event.</p>
      </div>

      {/* Event Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Event Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Title:</span>
            <span className="ml-2 text-gray-900">{formData.title}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Category:</span>
            <span className="ml-2 text-gray-900 capitalize">{formData.category}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Date:</span>
            <span className="ml-2 text-gray-900">{formData.startDate} at {formData.startTime}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Venue:</span>
            <span className="ml-2 text-gray-900 capitalize">{formData.venueType}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Ticket Types:</span>
            <span className="ml-2 text-gray-900">
              {formData.ticketTypes.length > 0 ?
                `${formData.ticketTypes.length} type${formData.ticketTypes.length > 1 ? 's' : ''}` :
                (formData.isPaid ? `₱${formData.ticketPrice}` : 'Free Event')
              }
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Promo Codes:</span>
            <span className="ml-2 text-gray-900">{formData.promoCodes.length} active</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Requirements:</span>
            <span className="ml-2 text-gray-900">
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
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Ticket Types</h4>
          <div className="space-y-4">
            {formData.ticketTypes.map((ticket, index) => (
              <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900">{ticket.name}</h5>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="font-medium text-gray-900">₱{ticket.price.toLocaleString()}</span>
                  </div>
                </div>
                {ticket.description && (
                  <p className="text-gray-600 text-sm mb-2">{ticket.description}</p>
                )}
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Max: {ticket.maxQuantity || 'Unlimited'}</span>
                  <span>{ticket.isActive ? 'Active' : 'Inactive'}</span>
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
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Event Requirements</h4>
          <div className="space-y-2">
            {formData.requirements.map((requirement, index) => (
              <div key={index} className="flex items-center text-sm">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-600 text-xs flex items-center justify-center mr-2">
                  {index + 1}
                </span>
                <span className="text-gray-900">{requirement}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promo Codes Summary */}
      {formData.promoCodes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Promo Codes</h4>
          <div className="space-y-3">
            {formData.promoCodes.map((promo) => (
              <div key={promo.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-medium text-blue-600">{promo.code}</span>
                    <span className="ml-2 text-gray-900">{promo.name}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {promo.discountType === 'percentage'
                      ? `${promo.discountValue}% off`
                      : `₱${promo.discountValue} off`
                    }
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                  <span>Valid: {promo.validFrom.toDate().toLocaleDateString()} - {promo.validUntil.toDate().toLocaleDateString()}</span>
                  <span>Max uses: {promo.maxUses || 'Unlimited'}</span>
                  <span>{promo.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forms Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Registration Form</h4>
          <div className="space-y-2">
            {formData.registrationForm.map((field, index) => (
              <div key={field.id} className="flex items-center text-sm">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center mr-2">
                  {index + 1}
                </span>
                <span className="text-gray-900">{field.label}</span>
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Feedback Form</h4>
          <div className="space-y-2">
            {formData.feedbackForm.map((field, index) => (
              <div key={field.id} className="flex items-center text-sm">
                <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 text-xs flex items-center justify-center mr-2">
                  {index + 1}
                </span>
                <span className="text-gray-900">{field.label}</span>
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Configuration Summary */}
      {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && formData.paymentConfigs && formData.paymentConfigs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Payment Configurations ({formData.paymentConfigs.length})</h4>
          <div className="space-y-4">
            {formData.paymentConfigs.map((config, index) => (
              <div key={config.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-gray-900">{config.name}</h5>
                  <span className={`px-2 py-1 text-xs rounded-full ${config.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {config.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h6 className="font-medium text-gray-700 mb-2">Bank Details</h6>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Bank: {config.bankDetails.bankName || '-'}</div>
                      <div>Account: {config.bankDetails.accountName || '-'}</div>
                      <div>Number: {config.bankDetails.accountNumber || '-'}</div>
                    </div>
                  </div>
                  <div>
                    <h6 className="font-medium text-gray-700 mb-2">Verification Settings</h6>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Screenshot Required: {config.requiresProof ? 'Yes' : 'No'}</div>
                      <div>Transaction ID: {config.requiresTransactionId ? 'Required' : 'Optional'}</div>
                      <div>Additional Fields: {config.paymentFields?.length || 0}</div>
                    </div>
                  </div>
                </div>
                {config.qrCodeUrl && (
                  <div className="mt-3">
                    <h6 className="font-medium text-gray-700 mb-2">QR Code</h6>
                    <img
                      src={config.qrCodeUrl}
                      alt="Payment QR Code"
                      className="w-24 h-24 object-cover border border-gray-200 rounded"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publish Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Ready to Publish?</h4>
            <p className="text-gray-600 mt-1">
              Your event will be published and visible to attendees immediately.
            </p>
            {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && (
              <p className="text-sm text-blue-600 mt-2 font-medium">
                📋 Registration will require payment verification before confirmation
              </p>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => handleSaveEvent(false)}
              disabled={loading || authLoading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {authLoading ? 'Authenticating...' : loading ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSaveEvent(true)}
              disabled={loading || authLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {authLoading ? 'Authenticating...' : loading ? 'Publishing...' : 'Publish Event'}
            </button>
            {eventId && (
              <button
                type="button"
                onClick={() => handleShareEvent(eventId, formData.title)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                title="Share Registration Link"
              >
                <ShareIcon className="w-4 h-4 mr-2" />
                Share
              </button>
            )}
          </div>
        </div>

        {/* Final Workflow Summary */}
        {(formData.isPaid || formData.ticketTypes.some(ticket => ticket.price > 0)) && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <h5 className="font-medium text-gray-900 mb-2">Event Registration Flow</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                <span>Attendee Registration ({formData.registrationForm.length} fields)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                <span>Payment & Verification ({formData.paymentConfigs?.reduce((total, config) => total + (config.paymentFields?.length || 0), 0) || 0} fields)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                <span>Post-Event Feedback ({formData.feedbackForm.length} fields)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Main component render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/events')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                Back to Events
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Sidebar - Step Navigation */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {isEditMode ? 'Edit Event' : 'Create Event'}
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
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : isCompleted
                          ? 'text-green-700 hover:bg-green-50'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : isCompleted
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {isCompleted ? (
                          <CheckCircleIcon className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${
                          isCurrent ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'text-gray-900'
                        }`}>
                          {step.title}
                        </div>
                      </div>
                      <Icon className={`w-4 h-4 ${
                        isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                      }`} />
                    </button>
                  );
                })}
              </nav>

              {/* Progress */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{currentStep + 1} of {steps.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9 mt-8 lg:mt-0">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {steps[currentStep].title}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Step {currentStep + 1} of {steps.length}
                  </p>
                </div>
              </div>

              <div className="px-6 py-6">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading event data...</span>
                  </div>
                )}
                
                {!loading && renderStepContent()}
              </div>

              {/* Navigation Buttons */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                    disabled={currentStep === steps.length - 1}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPage;


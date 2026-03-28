import React, { useState, useEffect, useRef } from 'react';
import { 
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  CheckIcon,
  XMarkIcon,
  UserPlusIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon, XCircleIcon as XCircleSolidIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/20/solid';
import { doc, updateDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../contexts/AuthContext';
import { Registration as FirestoreRegistration, Event } from '../../types';
import { ForceCheckInModal, WalkInRegistrationModal } from '../../components/shared/UI';
import { RegistrationService } from '../../services/registrationService';
import type { WalkInRegistrationData } from '../../components/shared/UI/WalkInRegistrationModal';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Result } from '@zxing/library';

interface Registration {
  id: string;
  qrCode: string;
  attendee: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    profilePicture?: string;
  };
  event: {
    id: string;
    title: string;
    date: string;
    venue: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'attended' | 'cancelled';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
}

// Scoped logger for this page - uses global logger utility
const log = {
  debug: (...args: unknown[]) => logger.debug('[AdminCheckIn]', ...args),
  info: (...args: unknown[]) => logger.info('[AdminCheckIn]', ...args),
  warn: (...args: unknown[]) => logger.warn('[AdminCheckIn]', ...args),
  error: (...args: unknown[]) => logger.error('[AdminCheckIn]', ...args),
};

// Date awareness helper functions
const getEventDateStatus = (event: Event | null) => {
  if (!event || !event.startDate) return null;
  
  try {
    const now = new Date();
    let eventStartDate: Date;
    let eventEndDate: Date;
    
    // Debug logging
    log.debug('Processing event dates:', { 
      startDate: event.startDate, 
      endDate: event.endDate,
      startDateType: typeof event.startDate,
      hasToDate: !!(event.startDate as any)?.toDate
    });
    
    // Handle different date formats for startDate with more robust checking
    if (event.startDate && (event.startDate as any).toDate && typeof (event.startDate as any).toDate === 'function') {
      // Firestore Timestamp object
      log.debug('Using toDate() method for startDate');
      eventStartDate = (event.startDate as any).toDate();
    } else if (event.startDate instanceof Date) {
      // Regular Date object
      log.debug('startDate is already a Date object');
      eventStartDate = event.startDate;
    } else if (typeof event.startDate === 'string') {
      // Date string
      log.debug('Parsing startDate as string');
      eventStartDate = new Date(event.startDate);
    } else if (typeof event.startDate === 'number') {
      // Unix timestamp
      log.debug('Parsing startDate as number');
      eventStartDate = new Date(event.startDate);
    } else if ((event.startDate as any)?.seconds && typeof (event.startDate as any).seconds === 'number') {
      // Firestore timestamp as plain object
      log.debug('Using seconds property for startDate');
      eventStartDate = new Date((event.startDate as any).seconds * 1000);
    } else {
      // Last resort - try to parse as any
      log.debug('Fallback parsing for startDate');
      eventStartDate = new Date(event.startDate as any);
    }
    
    // Handle different date formats for endDate
    if (event.endDate && (event.endDate as any).toDate && typeof (event.endDate as any).toDate === 'function') {
      eventEndDate = (event.endDate as any).toDate();
    } else if (event.endDate instanceof Date) {
      eventEndDate = event.endDate;
    } else if (typeof event.endDate === 'string') {
      eventEndDate = new Date(event.endDate);
    } else if (typeof event.endDate === 'number') {
      eventEndDate = new Date(event.endDate);
    } else if ((event.endDate as any)?.seconds && typeof (event.endDate as any).seconds === 'number') {
      eventEndDate = new Date((event.endDate as any).seconds * 1000);
    } else if (event.endDate) {
      eventEndDate = new Date(event.endDate as any);
    } else {
      // Use startDate as endDate if endDate is not available
      eventEndDate = eventStartDate;
    }
    
    // Check if dates are valid
    if (isNaN(eventStartDate.getTime()) || isNaN(eventEndDate.getTime())) {
      log.warn('Invalid event dates after parsing:', { 
        eventStartDate, 
        eventEndDate,
        originalStartDate: event.startDate,
        originalEndDate: event.endDate
      });
      return null;
    }
    
    log.debug('Successfully parsed dates:', { eventStartDate, eventEndDate });
    
    // Calculate time differences
    const timeDiffStart = eventStartDate.getTime() - now.getTime();
    const timeDiffEnd = eventEndDate.getTime() - now.getTime();
    const daysDiffStart = Math.floor(timeDiffStart / (1000 * 3600 * 24));
    const daysDiffEnd = Math.floor(timeDiffEnd / (1000 * 3600 * 24));
    
    // Event is in the past
    if (timeDiffEnd < 0) {
      const daysAgo = Math.abs(daysDiffEnd);
      return {
        type: 'past' as const,
        severity: daysAgo > 7 ? 'high' : daysAgo > 1 ? 'medium' : 'low',
        message: daysAgo === 0 ? 'This event ended today' :
                 daysAgo === 1 ? 'This event ended yesterday' :
                 `This event ended ${daysAgo} days ago`,
        daysAgo,
        canCheckIn: daysAgo <= 1 // Allow check-in up to 1 day after event
      };
    }
    
    // Event is happening now
    if (timeDiffStart <= 0 && timeDiffEnd >= 0) {
      return {
        type: 'current' as const,
        severity: 'none' as const,
        message: 'Event is happening now',
        canCheckIn: true
      };
    }
    
    // Event is in the future
    if (timeDiffStart > 0) {
      return {
        type: 'future' as const,
        severity: daysDiffStart > 7 ? 'high' : daysDiffStart > 1 ? 'medium' : 'low',
        message: daysDiffStart === 0 ? 'This event starts today' :
                 daysDiffStart === 1 ? 'This event starts tomorrow' :
                 `This event starts in ${daysDiffStart} days`,
        daysUntil: daysDiffStart,
        canCheckIn: daysDiffStart <= 1 // Allow check-in starting 1 day before event
      };
    }
    
    return null;
  } catch (error) {
    log.error('Error in getEventDateStatus:', error, { event });
    // Return null to gracefully degrade if date parsing fails
    return null;
  }
};

// Alert component for date warnings
interface DateWarningAlertProps {
  event: Event | null;
  className?: string;
}

const DateWarningAlert: React.FC<DateWarningAlertProps> = ({ event, className = '' }) => {
  const dateStatus = getEventDateStatus(event);
  
  if (!dateStatus || dateStatus.type === 'current') return null;
  
  const getAlertStyle = () => {
    if (dateStatus.type === 'past') {
      return dateStatus.severity === 'high' 
        ? 'bg-red-50 border-red-200 text-red-800'
        : 'bg-orange-50 border-orange-200 text-orange-800';
    }
    
    if (dateStatus.type === 'future') {
      return dateStatus.severity === 'high'
        ? 'bg-blue-50 border-blue-200 text-blue-800'
        : 'bg-yellow-50 border-yellow-200 text-yellow-800';
    }
    
    return 'bg-gray-50 border-gray-200 text-gray-800';
  };
  
  const getIcon = () => {
    if (dateStatus.type === 'past' && dateStatus.severity === 'high') {
      return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
    }
    if (dateStatus.type === 'past') {
      return <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />;
    }
    return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
  };
  
  return (
    <div className={`rounded-lg border p-3 ${getAlertStyle()} ${className}`}>
      <div className="flex items-center space-x-2">
        {getIcon()}
        <div className="flex-1">
          <p className="text-sm font-medium">
            {dateStatus.message}
          </p>
          {!dateStatus.canCheckIn && (
            <p className="text-xs mt-1 opacity-80">
              Check-in may not be appropriate for this event date.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminCheckInPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedQRCode, setScannedQRCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkinResult, setCheckinResult] = useState<{
    success: boolean;
    message: string;
    registration?: Registration;
  } | null>(null);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeTab, setActiveTab] = useState<'ready' | 'checkedIn'>('ready');
  
  // Force check-in modal state
  const [forceCheckInModal, setForceCheckInModal] = useState<{
    isOpen: boolean;
    registrationId: string;
    attendeeName: string;
    eventTitle: string;
    dateWarning: string;
    severity: 'low' | 'medium' | 'high';
  }>({
    isOpen: false,
    registrationId: '',
    attendeeName: '',
    eventTitle: '',
    dateWarning: '',
    severity: 'low'
  });

  // Walk-in registration modal state
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const scanningRef = useRef<boolean>(false);

  // Load registrations and events
  useEffect(() => {
    fetchRegistrations();
    fetchEvents();
  }, []);

  const fetchRegistrations = async () => {
    try {
      // Get all registrations and filter client-side for better debugging
      const registrationsQuery = query(collection(db, 'registrations'));
      
      const snapshot = await getDocs(registrationsQuery);
      const regs: Registration[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data() as FirestoreRegistration;
        
        log.debug('Raw registration data:', { docId: doc.id, data });
        
        // Map paymentStatus to match local interface
        const mapPaymentStatus = (status: any): Registration['paymentStatus'] => {
          if (status === 'paid') return 'paid';
          if (status === 'pending' || status === 'processing') return 'pending';
          if (status === 'failed') return 'failed';
          if (status === 'refunded') return 'refunded';
          return 'pending'; // Default for any other status including 'cancelled'
        };
        
        // Check registration status - could be in registrationStatus or attendanceStatus
        const registrationStatus = (data as any).registrationStatus;
        const rawPaymentStatus = data.paymentStatus as string; // Get raw string value
        const attendanceStatus = data.attendanceStatus;
        
        // Determine if registration is eligible for check-in
        let mappedStatus: Registration['status'] = 'pending';
        
        if (attendanceStatus === 'checked-in') {
          mappedStatus = 'attended';
        } else if (registrationStatus === 'approved' || rawPaymentStatus === 'paid') {
          mappedStatus = 'approved';
        } else if (registrationStatus === 'cancelled' || attendanceStatus === 'cancelled') {
          mappedStatus = 'cancelled';
        }
        
        log.debug('Mapped status:', { registrationStatus, rawPaymentStatus, attendanceStatus, mappedStatus });
        
        // Map Firestore data to local interface
        regs.push({
          id: doc.id,
          qrCode: data.qrCode || '', // Include QR code for scanning
          attendee: {
            id: data.userId || doc.id,
            name: data.userDetails?.name || 'Unknown',
            email: data.userDetails?.email || 'Unknown',
            phone: data.userDetails?.phoneNumber,
            organization: data.userDetails?.organization,
            profilePicture: undefined // Not available in current schema
          },
          event: {
            id: data.eventId,
            title: 'Event Title', // Will be populated from event data
            date: 'Event Date', // Will be populated from event data
            venue: 'Event Venue' // Will be populated from event data
          },
          status: mappedStatus,
          paymentStatus: mapPaymentStatus(data.paymentStatus)
        });
      }
      
      log.debug('Total registrations loaded:', regs.length);
      log.debug('Registrations by status:', regs.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)); // Debug log
      
      setRegistrations(regs);
    } catch (error) {
      log.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const eventsQuery = query(
        collection(db, 'events'),
        where('status', '==', 'published')
      );
      
      const snapshot = await getDocs(eventsQuery);
      const eventList: Event[] = [];
      
      snapshot.forEach(doc => {
        eventList.push({ id: doc.id, ...doc.data() } as Event);
      });
      
      setEvents(eventList);
      if (eventList.length > 0) {
        setCurrentEvent(eventList[0]);
      }
    } catch (error) {
      log.error('Error fetching events:', error);
    }
  };

  // Helper function to format event date
  const formatEventDate = (timestamp: any) => {
    if (!timestamp) return 'No Date';
    
    try {
      let date;
      
      // Handle different date formats with robust checking
      if (timestamp && typeof (timestamp as any).toDate === 'function') {
        // Firestore Timestamp object
        date = (timestamp as any).toDate();
      } else if (timestamp instanceof Date) {
        // Regular Date object
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        // Date string
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        // Unix timestamp
        date = new Date(timestamp);
      } else if ((timestamp as any)?.seconds && typeof (timestamp as any).seconds === 'number') {
        // Firestore timestamp as plain object (from Firestore emulator or client)
        date = new Date((timestamp as any).seconds * 1000);
      } else {
        // Try to create a Date object
        date = new Date(timestamp);
      }
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        log.warn('Invalid date:', timestamp);
        return 'Invalid Date';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      log.error('Error formatting date:', error);
      return 'Date Error';
    }
  };

  // Camera control functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
        
        // Initialize QR code reader
        if (!codeReaderRef.current) {
          codeReaderRef.current = new BrowserQRCodeReader();
        }
        
        // Start continuous scanning
        startQRScanning();
      }
    } catch (error) {
      log.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please check permissions and try again.');
    }
  };

  const stopCamera = () => {
    // Stop QR scanning
    scanningRef.current = false;
    setIsScanning(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startQRScanning = async () => {
    if (!videoRef.current || !codeReaderRef.current) return;
    
    scanningRef.current = true;
    setIsScanning(true);
    
    const scan = async () => {
      if (!scanningRef.current || !videoRef.current || !codeReaderRef.current) return;
      
      try {
        const result: Result = await codeReaderRef.current.decodeOnceFromVideoDevice(undefined, videoRef.current);
        
        if (result && result.getText()) {
          const qrCode = result.getText();
          log.info('QR Code detected:', qrCode);
          
          // Vibrate if supported (for mobile feedback)
          if ('vibrate' in navigator) {
            navigator.vibrate(200);
          }
          
          // Pause scanning while processing
          setIsScanning(false);
          
          // Process the QR code
          await handleQRCodeScan(qrCode);
          
          // Wait a bit before scanning again to avoid duplicate scans
          setTimeout(() => {
            if (scanningRef.current) {
              startQRScanning();
            }
          }, 2000);
        }
      } catch (error: any) {
        // NotFoundException is expected when no QR code is in view
        if (error.name !== 'NotFoundException') {
          log.warn('QR scanning error:', error);
        }
        
        // Continue scanning
        if (scanningRef.current) {
          requestAnimationFrame(scan);
        }
      }
    };
    
    scan();
  };

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleQRCodeScan = async (qrCode: string) => {
    if (!qrCode.trim()) return;

    try {
      const scanned = qrCode.trim();
      const registration = scanned.startsWith('registration:')
        ? registrations.find(r => r.id === scanned.replace('registration:', ''))
        : registrations.find(r => r.qrCode === scanned);
      
      if (!registration) {
        // Show error feedback
        setCheckinResult({
          success: false,
          message: 'Registration not found. Please check the QR code.'
        });
        toast.error('❌ Registration not found!', {
          duration: 3000,
          icon: '🔍',
        });
        
        // Play error sound (short vibration)
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        return;
      }

      if (registration.status === 'attended') {
        // Show warning feedback
        setCheckinResult({
          success: false,
          message: `${registration.attendee.name} has already been checked in.`
        });
        toast.error(`⚠️ ${registration.attendee.name} already checked in!`, {
          duration: 3000,
        });
        
        // Play warning sound (double vibration)
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 100, 100]);
        }
        return;
      }

      if (registration.status !== 'approved' && registration.paymentStatus !== 'paid') {
        // Show error feedback
        setCheckinResult({
          success: false,
          message: 'Registration must be approved and payment verified before check-in.'
        });
        toast.error('❌ Registration not approved or payment pending!', {
          duration: 4000,
        });
        
        // Play error sound
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        return;
      }

      // Check event date status and add warning message if necessary
      const dateStatus = getEventDateStatus(currentEvent);
      let successMessage = `${registration.attendee.name} has been checked in successfully!`;
      
      if (dateStatus && !dateStatus.canCheckIn) {
        successMessage += ` ⚠️ Note: ${dateStatus.message.toLowerCase()}`;
      }

      // Update registration status to attended
      const registrationRef = doc(db, 'registrations', registration.id);
      await updateDoc(registrationRef, {
        attendanceStatus: 'checked-in',
        checkedInAt: serverTimestamp(),
        checkedInBy: userProfile?.uid || 'admin'
      });

      // Update local state
      setRegistrations(prev => prev.map(r => 
        r.id === registration.id ? { ...r, status: 'attended' as const } : r
      ));

      // Switch to checked-in tab to show the result
      setActiveTab('checkedIn');

      // Show success feedback
      setCheckinResult({
        success: true,
        message: successMessage,
        registration
      });
      
      toast.success(`✅ ${registration.attendee.name} checked in!`, {
        duration: 3000,
        icon: '🎉',
      });
      
      // Play success sound (long vibration)
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }

      // Clear QR code input
      setScannedQRCode('');

      // Clear result after 3 seconds
      setTimeout(() => setCheckinResult(null), 3000);

    } catch (error) {
      log.error('Error during check-in:', error);
      
      // Show error feedback
      setCheckinResult({
        success: false,
        message: 'Failed to check in attendee. Please try again.'
      });
      
      toast.error('❌ Check-in failed! Please try again.', {
        duration: 4000,
      });
      
      // Play error sound
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
    }
  };

  const handleManualCheckin = async (registrationId: string) => {
    try {
      const registration = registrations.find(r => r.id === registrationId);
      if (!registration) return;

      if (registration.status === 'attended') {
        alert('Attendee already checked in.');
        return;
      }

      if (registration.status !== 'approved' && registration.paymentStatus !== 'paid') {
        alert('Registration must be approved and payment verified before check-in.');
        return;
      }

      // Check event date status and show modal if necessary
      const dateStatus = getEventDateStatus(currentEvent);
      if (dateStatus && !dateStatus.canCheckIn) {
        // Show custom modal instead of browser confirm
        setForceCheckInModal({
          isOpen: true,
          registrationId: registration.id,
          attendeeName: registration.attendee.name,
          eventTitle: currentEvent?.title || 'Event',
          dateWarning: dateStatus.message,
          severity: dateStatus.severity as 'low' | 'medium' | 'high'
        });
        return;
      }

      // Proceed with normal check-in if no date issues
      await performCheckIn(registrationId);

    } catch (error) {
      log.error('Error during manual check-in:', error);
      setCheckinResult({
        success: false,
        message: 'Failed to check in attendee. Please try again.'
      });
    }
  };

  // Separate function to perform the actual check-in
  const performCheckIn = async (registrationId: string) => {
    try {
      const registration = registrations.find(r => r.id === registrationId);
      if (!registration) return;

      // Check event date status for success message
      const dateStatus = getEventDateStatus(currentEvent);
      let successMessage = `${registration.attendee.name} has been checked in successfully!`;
      if (dateStatus && !dateStatus.canCheckIn) {
        successMessage += ` ⚠️ Note: ${dateStatus.message.toLowerCase()}`;
      }

      const registrationRef = doc(db, 'registrations', registration.id);
      await updateDoc(registrationRef, {
        attendanceStatus: 'checked-in',
        checkedInAt: serverTimestamp(),
        checkedInBy: userProfile?.uid || 'admin'
      });

      // Update local state
      setRegistrations(prev => prev.map(r => 
        r.id === registrationId ? { ...r, status: 'attended' as const } : r
      ));

      // Switch to checked-in tab to show the result
      setActiveTab('checkedIn');

      setCheckinResult({
        success: true,
        message: successMessage,
        registration
      });

      // Clear result after 3 seconds
      setTimeout(() => setCheckinResult(null), 3000);

    } catch (error) {
      log.error('Error during check-in:', error);
      setCheckinResult({
        success: false,
        message: 'Failed to check in attendee. Please try again.'
      });
    }
  };

  // Modal handlers
  const handleForceCheckInConfirm = async () => {
    setForceCheckInModal(prev => ({ ...prev, isOpen: false }));
    await performCheckIn(forceCheckInModal.registrationId);
  };

  const handleForceCheckInCancel = () => {
    setForceCheckInModal(prev => ({ ...prev, isOpen: false }));
  };

  // Walk-in registration handler
  const handleWalkInRegistration = async (data: WalkInRegistrationData) => {
    if (!currentEvent || !userProfile) {
      throw new Error('Event or user profile not found');
    }

    try {
      // Extract name and email from customFormData (from the dynamic registration form)
      // PRIORITIZE customFormData fields over fallback fields
      const customData = data.customFormData || {};
      
      log.debug('Walk-in registration customFormData:', customData);
      log.debug('Current event registration form:', (currentEvent as any)?.registrationForm);
      
      // Helper function to find field by checking the registration form structure
      const findFieldByType = (fieldType: string): string | undefined => {
        const registrationForm = (currentEvent as any)?.registrationForm || [];
        const field = registrationForm.find((f: any) => f.type === fieldType);
        if (field && customData[field.id]) {
          return customData[field.id];
        }
        return undefined;
      };
      
      // Helper function to find a field value by checking both key and field labels
      const findFieldValue = (keywords: string[], fieldType?: string): string | undefined => {
        // First try to find by field type in registration form
        if (fieldType) {
          const value = findFieldByType(fieldType);
          if (value) return value;
        }
        
        // Try to find by key name (for fallback forms)
        const entry = Object.entries(customData).find(([key, value]) => {
          if (typeof value !== 'string' || !value.trim()) return false;
          const lowerKey = key.toLowerCase();
          return keywords.some(keyword => lowerKey.includes(keyword));
        });
        
        if (entry) return entry[1] as string;
        
        // Try to match by checking field labels in registration form
        const registrationForm = (currentEvent as any)?.registrationForm || [];
        for (const field of registrationForm) {
          const lowerLabel = (field.label || '').toLowerCase();
          if (keywords.some(keyword => lowerLabel.includes(keyword)) && customData[field.id]) {
            return customData[field.id];
          }
        }
        
        return undefined;
      };
      
      // Extract fields with improved logic - check by field type first, then keywords
      const name = findFieldValue(['name', 'fullname', 'full_name', 'full name', 'attendee'], 'text') || data.name || 'Walk-in Attendee';
      const email = findFieldValue(['email', 'e-mail', 'e_mail', 'mail'], 'email') || data.email || `walkin-${Date.now()}@temp.local`;
      const phoneNumber = findFieldValue(['phone', 'mobile', 'contact', 'number', 'tel'], 'phone') || data.phoneNumber;
      const organization = findFieldValue(['organization', 'organisation', 'company', 'org', 'affiliation']) || data.organization;
      
      log.debug('Extracted walk-in data:', { name, email, phoneNumber, organization });

      const result = await RegistrationService.createWalkInRegistration({
        eventId: currentEvent.id,
        userDetails: {
          name,
          email,
          phoneNumber,
          organization
        },
        ticketTypeId: data.ticketTypeId,
        quantity: data.quantity,
        paymentStatus: data.paymentStatus,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference,
        notes: data.notes,
        customFormData: data.customFormData, // Pass custom form data to service
        registeredBy: userProfile.uid
      });

      // Reload registrations to include the new walk-in
      await fetchRegistrations();
      await fetchEvents(); // Refresh event data with updated counts

      toast.success(`Walk-in registration completed! QR Code: ${result.qrCode}`);
    } catch (error: any) {
      logger.error('Walk-in registration error:', error);
      throw error;
    }
  };

  // Filter registrations for current event
  const eventRegistrations = currentEvent 
    ? registrations.filter(r => r.event.id === currentEvent.id)
    : registrations;

  // Search filter function
  const filterBySearch = (registration: Registration) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const name = registration.attendee.name.toLowerCase();
    const email = registration.attendee.email.toLowerCase();
    const organization = registration.attendee.organization?.toLowerCase() || '';
    const phone = registration.attendee.phone?.toLowerCase() || '';
    
    return name.includes(query) || 
           email.includes(query) || 
           organization.includes(query) ||
           phone.includes(query) ||
           registration.id.toLowerCase().includes(query);
  };

  const readyForCheckin = eventRegistrations.filter(r => {
    // Ready if status is 'approved' OR paymentStatus is 'paid', but not yet attended
    const isReadyStatus = r.status === 'approved' || r.status === 'paid' || r.paymentStatus === 'paid';
    const notAttended = r.status !== 'attended';
    return isReadyStatus && notAttended && filterBySearch(r);
  });
  
  const checkedIn = eventRegistrations.filter(r => r.status === 'attended' && filterBySearch(r));

  if (loading) {
    return (
      <AdminLayout title="Check-In" subtitle="Loading...">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-gray-200 rounded-xl"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Check-In Station" 
      subtitle="Scan QR codes to check in attendees"
    >
      <div className="space-y-6">
        {/* Event Selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Event
          </label>
          <select
            value={currentEvent?.id || ''}
            onChange={(e) => {
              const event = events.find(ev => ev.id === e.target.value);
              setCurrentEvent(event || null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.title} - {formatEventDate(event.startDate)}
              </option>
            ))}
          </select>
        </div>

        {/* Date Warning Alert */}
        <DateWarningAlert event={currentEvent} />

        {/* Walk-In Registration Button - Only show for published/ongoing events */}
        {currentEvent && (currentEvent.status === 'published' || currentEvent.status === 'ongoing') && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <UserPlusIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Walk-In Registration</h3>
                  <p className="text-xs text-gray-600">Register attendees on-site without online payment</p>
                </div>
              </div>
              <button
                onClick={() => setIsWalkInModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <UserPlusIcon className="h-5 w-5" />
                <span>Add Walk-In</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircleSolidIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Checked In</p>
                <p className="text-2xl font-bold text-gray-900">{checkedIn.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Ready for Check-in</p>
                <p className="text-2xl font-bold text-gray-900">{readyForCheckin.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Approved</p>
                <p className="text-2xl font-bold text-gray-900">{eventRegistrations.filter(r => r.status === 'approved').length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Camera Scanner */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code Scanner</h3>
            
            {/* Camera Preview */}
            <div className="mb-6">
              <div className="max-w-md mx-auto">
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-64 object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {!isCameraActive && (
                      <div className="text-center">
                        <CameraIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Camera not active</p>
                      </div>
                    )}
                  </div>
                  {/* Scanning overlay */}
                  {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 rounded-lg transition-all ${
                        isScanning ? 'border-blue-500 animate-pulse' : 'border-green-500'
                      }`}>
                        <div className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg ${
                          isScanning ? 'border-blue-500' : 'border-green-500'
                        }`}></div>
                        <div className={`absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg ${
                          isScanning ? 'border-blue-500' : 'border-green-500'
                        }`}></div>
                        <div className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg ${
                          isScanning ? 'border-blue-500' : 'border-green-500'
                        }`}></div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 rounded-br-lg ${
                          isScanning ? 'border-blue-500' : 'border-green-500'
                        }`}></div>
                      </div>
                      {/* Scanning status indicator */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          isScanning 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-green-500 text-white'
                        }`}>
                          {isScanning ? '🔍 Scanning...' : '✓ Ready'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 space-y-2">
                  {!isCameraActive ? (
                    <button
                      onClick={startCamera}
                      className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      📷 Start Camera
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      🛑 Stop Camera
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Manual Input */}
            <div className="max-w-md mx-auto space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Or enter QR code manually..."
                  value={scannedQRCode}
                  onChange={(e) => setScannedQRCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleQRCodeScan(scannedQRCode)}
                />
              </div>
              <button
                onClick={() => handleQRCodeScan(scannedQRCode)}
                disabled={!scannedQRCode.trim()}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Check In Attendee
              </button>
            </div>
          </div>
        </div>

        {/* Check-in Result */}
        {checkinResult && (
          <div className={`bg-white rounded-xl border p-6 ${
            checkinResult.success 
              ? 'border-green-200 bg-green-50' 
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${
                checkinResult.success ? 'bg-green-100' : 'bg-red-100'
              } mb-4`}>
                {checkinResult.success ? (
                  <CheckCircleSolidIcon className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircleSolidIcon className="w-6 h-6 text-red-600" />
                )}
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                checkinResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {checkinResult.success ? 'Check-in Successful!' : 'Check-in Failed'}
              </h3>
              <p className={`text-sm ${
                checkinResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {checkinResult.message}
              </p>
            </div>
          </div>
        )}

        {/* Attendees Management Tabs */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('ready')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'ready'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Ready for Check-in
                <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-blue-100 text-blue-800">
                  {readyForCheckin.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('checkedIn')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'checkedIn'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Checked In
                <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-green-100 text-green-800">
                  {checkedIn.length}
                </span>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'ready' ? (
              <div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">Attendees Ready for Check-in</h3>
                      {(() => {
                        const dateStatus = getEventDateStatus(currentEvent);
                        if (dateStatus && !dateStatus.canCheckIn) {
                          return (
                            <p className="text-sm text-amber-600 mt-1 flex items-center">
                              <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                              {dateStatus.message} - Check-ins should be verified
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, email, organization, phone, or registration ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Search results indicator */}
                  {searchQuery && readyForCheckin.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Found <span className="font-semibold text-blue-600">{readyForCheckin.length}</span> attendee{readyForCheckin.length !== 1 ? 's' : ''} matching "{searchQuery}"
                    </div>
                  )}
                </div>
                
                {readyForCheckin.length === 0 ? (
                  <div className="text-center py-8">
                    {searchQuery ? (
                      <>
                        <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No attendees found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          No attendees match your search "{searchQuery}"
                        </p>
                        <button
                          onClick={() => setSearchQuery('')}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Clear search
                        </button>
                      </>
                    ) : (
                      <>
                        <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No attendees ready for check-in</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          All approved and paid attendees have been checked in.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {readyForCheckin.map((registration) => (
                      <div key={registration.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {registration.attendee.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{registration.attendee.name}</p>
                            <p className="text-sm text-gray-500">{registration.attendee.email}</p>
                            {registration.attendee.organization && (
                              <p className="text-xs text-gray-400">{registration.attendee.organization}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleManualCheckin(registration.id)}
                          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Check In
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Checked In Attendees</h3>
                    <p className="text-sm text-gray-500">{checkedIn.length} checked in</p>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, email, organization, phone, or registration ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Search results indicator */}
                  {searchQuery && checkedIn.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Found <span className="font-semibold text-green-600">{checkedIn.length}</span> checked-in attendee{checkedIn.length !== 1 ? 's' : ''} matching "{searchQuery}"
                    </div>
                  )}
                </div>
                
                {checkedIn.length === 0 ? (
                  <div className="text-center py-8">
                    {searchQuery ? (
                      <>
                        <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No attendees found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          No checked-in attendees match your search "{searchQuery}"
                        </p>
                        <button
                          onClick={() => setSearchQuery('')}
                          className="mt-3 text-sm text-green-600 hover:text-green-800 font-medium"
                        >
                          Clear search
                        </button>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No attendees checked in yet</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Checked in attendees will appear here.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {checkedIn.map((registration) => (
                      <div key={registration.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckIcon className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{registration.attendee.name}</p>
                            <p className="text-sm text-gray-500">{registration.attendee.email}</p>
                            {registration.attendee.organization && (
                              <p className="text-xs text-gray-400">{registration.attendee.organization}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-green-600 font-medium">✓ Checked In</span>
                          <p className="text-xs text-gray-500">Just now</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Force Check-In Modal */}
      <ForceCheckInModal
        isOpen={forceCheckInModal.isOpen}
        onClose={handleForceCheckInCancel}
        onConfirm={handleForceCheckInConfirm}
        attendeeName={forceCheckInModal.attendeeName}
        eventTitle={forceCheckInModal.eventTitle}
        dateWarning={forceCheckInModal.dateWarning}
        severity={forceCheckInModal.severity}
      />

      {/* Walk-In Registration Modal */}
      {currentEvent && (
        <WalkInRegistrationModal
          isOpen={isWalkInModalOpen}
          onClose={() => setIsWalkInModalOpen(false)}
          event={currentEvent}
          onSubmit={handleWalkInRegistration}
        />
      )}
    </AdminLayout>
  );
};

export default AdminCheckInPage;

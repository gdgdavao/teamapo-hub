import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAbility } from '@casl/react';
import { 
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  CheckIcon,
  XMarkIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  StopIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon, XCircleIcon as XCircleSolidIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/20/solid';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { SkeletonList } from '../../../../components/UI';
import { useAuth } from '../../../../contexts/AuthContext';
import { Registration as FirestoreRegistration, Event } from '../../../../types';
import { asRegistration } from '../../../../auth/ability';
import ForceCheckInModal from './ForceCheckInModal';
import WalkInRegistrationModal from './WalkInRegistrationModal';
import KioskSetupModal from '../../../../components/KioskSetupModal';
import { RegistrationService } from '../../../../services/registrationService';
import { EventService } from '../../../../services/eventService';
import type { WalkInRegistrationData } from './WalkInRegistrationModal';
import toast from 'react-hot-toast';
import { logger } from '../../../../utils/logger';
import { toDateSafe } from '../../../../utils/dateUtils';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { Result } from '@zxing/library';
import { CameraService } from '../../../../services/cameraService';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';
import { getKioskCamera } from '../../../../hooks/useKioskCamera';

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
    // Debug logging
    log.debug('Processing event dates:', { 
      startDate: event.startDate, 
      endDate: event.endDate,
      startDateType: typeof event.startDate,
      hasToDate: !!(event.startDate as any)?.toDate
    });
    
    const now = new Date();
    const eventStartDate = toDateSafe(event.startDate) ?? new Date(0);
    const eventEndDate = toDateSafe(event.endDate) ?? eventStartDate;
    
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
      return <ExclamationTriangleIcon className="w-5 h-5 text-error" />;
    }
    if (dateStatus.type === 'past') {
      return <ExclamationTriangleIcon className="w-5 h-5 text-warning" />;
    }
    return <InformationCircleIcon className="w-5 h-5 text-primary" />;
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
            <p className="text-sm mt-1 opacity-80">
              Check-in may not be appropriate for this event date.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

interface CheckInTabProps {
  /** Required. The tab renders inside /events/:eventId; see AttendeesTab. */
  eventId: string;
}

const CheckInTab: React.FC<CheckInTabProps> = ({ eventId }) => {
  const { userProfile } = useAuth();
  const ability = useAbility();
  const isMobile = useMediaQuery('(max-width: 640px)');
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
  const [activeTab, setActiveTab] = useState<'ready' | 'checkedIn'>('ready');

  const eventOrganizerUid = currentEvent?.organizer?.uid;
  const canCheckIn = ability.can('checkin', asRegistration({ organizerUid: eventOrganizerUid } as any));
  const canCreateWalkIn = ability.can('create', asRegistration({ organizerUid: eventOrganizerUid } as any));
  
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

  // Kiosk mode launcher state & modal
  const navigate = useNavigate();
  const [isKioskSetupOpen, setIsKioskSetupOpen] = useState(false);

  const handleLaunchKiosk = () => {
    stopCamera();
    setIsKioskSetupOpen(true);
  };

  const handleKioskLaunch = () => {
    setIsKioskSetupOpen(false);
    navigate(`/events/${eventId}/kiosk`);
  };
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef<boolean>(false);

  // Events first — the roster is scoped to whichever event is selected.
  useEffect(() => {
    if (userProfile?.uid) fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  useEffect(() => {
    if (!currentEvent?.id) {
      setRegistrations([]);
      return;
    }
    fetchRegistrations(currentEvent.id);
  }, [currentEvent?.id]);

  const fetchRegistrations = async (eventId: string) => {
    try {
      // Scoped to one event: the page only ever displayed the selected event's roster,
      // so reading the whole collection was pure waste. firestore.rules also scopes
      // /registrations by organizerUid, so an unscoped read is denied outright.
      const snapshot = await RegistrationService.getEventRegistrations(eventId);
      const regs: Registration[] = [];

      for (const reg of snapshot) {
        const id = reg.id;
        const data = reg as FirestoreRegistration;
        
        log.debug('Raw registration data:', { docId: id, data });
        
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
          id,
          qrCode: data.qrCode || '', // Include QR code for scanning
          attendee: {
            id: data.userId || id,
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
      // Organizers only see events they own: writes to another organizer's roster are
      // denied by firestore.rules, so offering them would fail mid-queue at the door.
      const canReadAll = ability.can('read', 'all');
      const eventList = canReadAll || !userProfile?.uid
        ? await EventService.getPublishedEvents()
        : await EventService.getEventsByOrganizer(userProfile.uid);

      // The workspace always supplies an eventId, but the roster may still not
      // contain it (unpublished, or owned by someone else), so fall back to a
      // direct read rather than leaving the station on whichever event sorts first.
      const requestedId = eventId;
      const requested = requestedId
        ? eventList.find((e) => e.id === requestedId)
        : undefined;
      if (requestedId && !requested) {
        const directEvent = await EventService.getEvent(requestedId);
        if (directEvent) {
          setCurrentEvent(directEvent);
          return;
        }
      }
      setCurrentEvent(requested ?? eventList[0] ?? null);
    } catch (error) {
      log.error('Error fetching events:', error);
    }
  };

  // Camera control functions
  const startCamera = async () => {
    // Hardware idempotency: a double-tap on "Start Camera" must not spawn a
    // second concurrent acquisition against the same lens (the loser used to
    // leak as a dead stream with the LED on).
    if (streamRef.current) return;

    try {
      // Gate before the ladder: a plain-http venue LAN has no
      // navigator.mediaDevices and would die as a cryptic TypeError below.
      const support = CameraService.supportsKioskCamera();
      if (support) {
        toast.error(support.message);
        return;
      }

      const storedCamera = getKioskCamera(eventId);
      const { stream } = await CameraService.acquireKioskStream(
        {
          deviceId: storedCamera?.deviceId,
          facingMode: storedCamera?.facingMode || 'environment',
        },
        {
          preferOsDefault: !isMobile && !storedCamera?.deviceId,
          deviceIdExact: false,
          onFallback: (stage) => log.warn('Camera ladder fallback:', stage),
        }
      );

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
      toast.error(CameraService.describeCameraFailure(error).message);
    }
  };

  const stopCamera = () => {
    // Stop QR scanning
    scanningRef.current = false;
    setIsScanning(false);

    if (scannerControlsRef.current) {
      try {
        scannerControlsRef.current.stop();
      } catch {
        // Ignore
      }
      scannerControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks?.().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {
            // Ignore
          }
        });
      }
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {
        // Ignore
      }
    }
    codeReaderRef.current = null;
    setIsCameraActive(false);
  };

  const startQRScanning = async () => {
    if (!videoRef.current) return;
    if (!codeReaderRef.current) {
      codeReaderRef.current = new BrowserQRCodeReader();
    }

    if (scannerControlsRef.current) {
      try {
        scannerControlsRef.current.stop();
      } catch {
        // Ignore
      }
      scannerControlsRef.current = null;
    }

    scanningRef.current = true;
    setIsScanning(true);

    try {
      scannerControlsRef.current = await codeReaderRef.current.decodeFromVideoElement(
        videoRef.current,
        async (result, error) => {
          if (!scanningRef.current) return;

          if (result && result.getText()) {
            const qrCode = result.getText();
            log.info('QR Code detected:', qrCode);

            // Vibrate if supported (for mobile feedback)
            if ('vibrate' in navigator) {
              navigator.vibrate(200);
            }

            // Pause scanning while processing
            scanningRef.current = false;
            setIsScanning(false);

            // Process the QR code
            await handleQRCodeScan(qrCode);

            // Wait a bit before scanning again to avoid duplicate scans
            setTimeout(() => {
              if (scanningRef.current) {
                setIsScanning(true);
              }
            }, 2000);
          }

          if (error && (error as Error).name !== 'NotFoundException') {
            log.debug('Scanning frame notice:', error);
          }
        }
      );
    } catch (scanErr) {
      log.warn('Scanner start warning:', scanErr);
    }
  };

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleQRCodeScan = async (qrCode: string) => {
    if (!qrCode.trim()) return;

    if (!canCheckIn) {
      setCheckinResult({
        success: false,
        message: 'You do not have permission to check in attendees.'
      });
      toast.error('Check-in permission required.');
      return;
    }

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
        toast.error('Registration not found. Please check the QR code.', {
          duration: 3000,
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
        toast.error(`${registration.attendee.name} already checked in.`, {
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
        toast.error('Registration not approved or payment is pending.', {
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
        successMessage += ` (Note: ${dateStatus.message.toLowerCase()})`;
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
      
      toast.success(`${registration.attendee.name} checked in.`, {
        duration: 3000,
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
      
      toast.error('Check-in failed. Please scan again.', {
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
      if (!canCheckIn) {
        toast.error('You do not have permission to check in attendees.');
        return;
      }

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
        successMessage += ` (Note: ${dateStatus.message.toLowerCase()})`;
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
    if (!canCreateWalkIn) {
      toast.error('You do not have permission to register walk-in attendees.');
      throw new Error('You do not have permission to register walk-in attendees.');
    }

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
      const firstName = findFieldValue(['first name', 'firstname', 'first_name', 'given name', 'first'], 'text');
      const lastName = findFieldValue(['last name', 'lastname', 'last_name', 'family name', 'surname', 'last'], 'text');
      const combinedFirstLast = (firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : undefined;
      const name = combinedFirstLast || findFieldValue(['name', 'fullname', 'full_name', 'full name', 'attendee'], 'text') || data.name || 'Walk-in Attendee';
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

      // Refresh counts and pull the new walk-in into the roster
      await fetchEvents();
      if (currentEvent?.id) await fetchRegistrations(currentEvent.id);

      toast.success(`Walk-in registration completed. QR Code: ${result.qrCode}`);
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
      <div className="py-6">
        <SkeletonList rows={3} />
      </div>
    );
  }

  const checkInContent = (
    <>
      <div className="space-y-6">

      {/* Date Warning Alert */}
        <DateWarningAlert event={currentEvent} />

        {/* Quick Operations: Kiosk Mode & Walk-In */}
        {currentEvent && canCheckIn && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kiosk Mode Card */}
            <div className="bg-gradient-to-r from-surface to-secondary-container/40 border border-outline-variant rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-secondary-container p-2 rounded-lg">
                  <ComputerDesktopIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">Attendee Kiosk Mode</h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant">Launch full-screen self-check-in station for attendees</p>
                </div>
              </div>
              <button
                onClick={handleLaunchKiosk}
                className="px-4 py-2 bg-secondary text-on-secondary font-medium rounded-lg hover:bg-secondary-hover transition-colors flex items-center space-x-2 shrink-0 min-h-[44px]"
              >
                <ComputerDesktopIcon className="h-5 w-5" />
                <span>Launch Kiosk</span>
              </button>
            </div>

            {/* Walk-In Registration Card */}
            {canCreateWalkIn && (currentEvent.status === 'published' || currentEvent.status === 'ongoing') ? (
              <div className="bg-gradient-to-r from-surface-container-low to-primary-container border border-outline-variant rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-secondary-container p-2 rounded-lg">
                    <UserPlusIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-on-surface">Walk-In Registration</h3>
                    <p className="text-xs sm:text-sm text-on-surface-variant">Register attendees on-site without online payment</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsWalkInModalOpen(true)}
                  className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors flex items-center space-x-2 shrink-0 min-h-[44px]"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  <span>Add Walk-In</span>
                </button>
              </div>
            ) : <div />}
          </div>
        )}

        {/* Dual-Pane Mission Control on Desktop (Scanner + Manual on Left, Live Queue on Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Camera Scanner & Manual Input (Sticky on Desktop) */}
          <div className="xl:col-span-5 2xl:col-span-5 space-y-6 xl:sticky xl:top-24">
            {/* Camera Scanner */}
            <div className="bg-white rounded-xl border border-outline-variant p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-outline-variant">
            <div>
              <h3 className="text-lg font-semibold text-on-surface">QR Code Scanner</h3>
              <p className="text-sm text-on-surface-variant">Scan attendee QR badges or search below to check attendees in.</p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto bg-surface-container-low border border-outline-variant px-3.5 py-1.5 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircleSolidIcon className="w-5 h-5 text-success" />
                <span className="text-sm font-semibold text-on-surface">
                  {checkedIn.length} / {readyForCheckin.length + checkedIn.length}
                </span>
                <span className="text-xs text-on-surface-variant font-medium">Checked In</span>
              </div>
              <span className="text-outline-variant">|</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success-container text-on-success-container">
                {readyForCheckin.length + checkedIn.length > 0 
                  ? `${Math.round((checkedIn.length / (readyForCheckin.length + checkedIn.length)) * 100)}%` 
                  : '0%'}
              </span>
            </div>
          </div>
            
          <div className="text-center">
            {/* Camera Preview */}
            <div className="mb-6">
              <div className="max-w-md mx-auto">
                <div className="relative bg-surface-container rounded-lg overflow-hidden">
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
                        <CameraIcon className="mx-auto h-12 w-12 text-outline-variant mb-2" />
                        <p className="text-sm text-on-surface-variant">Camera not active</p>
                      </div>
                    )}
                  </div>
                  {/* Scanning overlay */}
                  {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 rounded-lg transition-colors duration-fast ease-quart relative ${
                        isScanning ? 'border-primary' : 'border-success'
                      }`}>
                        {isScanning && (
                          <div className="absolute inset-0 overflow-hidden rounded-[6px] pointer-events-none">
                            <div className="w-full h-full flex flex-col justify-end animate-scanline motion-reduce:hidden">
                              <div className="relative w-full flex items-center justify-center">
                                <div className="absolute w-full h-6 bg-gradient-to-r from-transparent via-primary/20 to-transparent blur-sm pointer-events-none" />
                                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_2px_rgba(26,115,232,0.85)] pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        )}
                        <div className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg ${
                          isScanning ? 'border-primary' : 'border-success'
                        }`}></div>
                        <div className={`absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg ${
                          isScanning ? 'border-primary' : 'border-success'
                        }`}></div>
                        <div className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg ${
                          isScanning ? 'border-primary' : 'border-success'
                        }`}></div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 rounded-br-lg ${
                          isScanning ? 'border-primary' : 'border-success'
                        }`}></div>
                      </div>
                      {/* Scanning status indicator */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 ${
                          isScanning 
                            ? 'bg-primary text-white' 
                            : 'bg-success text-white'
                        }`}>
                          {isScanning ? (
                            <>
                              <MagnifyingGlassIcon className="h-4 w-4 animate-pulse" aria-hidden="true" />
                              <span>Scanning...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircleSolidIcon className="h-4 w-4" aria-hidden="true" />
                              <span>Ready</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 space-y-2">
                  {!isCameraActive ? (
                    <button
                      onClick={startCamera}
                      disabled={!canCheckIn}
                      title={!canCheckIn ? 'Check-in permission required' : undefined}
                      className="w-full min-h-[48px] px-4 py-3 bg-success text-white font-medium rounded-lg hover:bg-success-hover active:scale-[0.98] transition-[background-color,transform] duration-short2 ease-emphasized-standard flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CameraIcon className="h-5 w-5" aria-hidden="true" />
                      <span>Start Camera</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className="w-full min-h-[48px] px-4 py-3 bg-error text-white font-medium rounded-lg hover:bg-error-hover active:scale-[0.98] transition-[background-color,transform] duration-short2 ease-emphasized-standard flex items-center justify-center gap-2"
                    >
                      <StopIcon className="h-5 w-5" aria-hidden="true" />
                      <span>Stop Camera</span>
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
                  className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-center text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleQRCodeScan(scannedQRCode)}
                />
              </div>
              <button
                onClick={() => handleQRCodeScan(scannedQRCode)}
                disabled={!scannedQRCode.trim() || !canCheckIn}
                title={!canCheckIn ? 'Check-in permission required' : undefined}
                className="w-full px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:bg-surface-container-highest disabled:cursor-not-allowed transition-colors"
              >
                Check In Attendee
              </button>
            </div>
          </div>
        </div>

        {/* Check-in Result */}
        {checkinResult && (
          <div className={`rounded-xl border p-6 ${
            checkinResult.success 
              ? 'border-outline-variant bg-success-container animate-success-pop motion-reduce:animate-none' 
              : 'border-outline-variant bg-error-container animate-micro-shake motion-reduce:animate-none'
          }`}>
            <div className="text-center">
              <div className={`relative inline-flex items-center justify-center w-14 h-14 rounded-full ${
                checkinResult.success ? 'bg-success/15 ring-4 ring-success/20' : 'bg-error/15 ring-4 ring-error/20'
              } mb-4 animate-pop-in motion-reduce:animate-none`}>
                {checkinResult.success ? (
                  <CheckCircleSolidIcon className="w-8 h-8 text-success" />
                ) : (
                  <XCircleSolidIcon className="w-8 h-8 text-error" />
                )}
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                checkinResult.success ? 'text-on-success-container' : 'text-on-error-container'
              }`}>
                {checkinResult.success ? 'Check-in Successful!' : 'Check-in Failed'}
              </h3>
              <p className={`text-sm ${
                checkinResult.success ? 'text-success font-medium' : 'text-error font-medium'
              }`}>
                {checkinResult.message}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Live Attendee Queue & Management Tabs */}
      <div className="xl:col-span-7 2xl:col-span-7 space-y-6">
        {/* Attendees Management Tabs */}
        <div className="bg-white rounded-xl border border-outline-variant">
          {/* Tab Navigation */}
          <div className="border-b border-outline-variant">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('ready')}
                className={`py-4 px-1 min-h-[48px] border-b-2 font-medium text-sm transition-[color,border-color,transform] duration-short2 ease-emphasized-standard active:scale-[0.98] ${
                  activeTab === 'ready'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                }`}
              >
                Ready for Check-in
                <span className="ml-2 py-0.5 px-2 rounded-full text-sm bg-secondary-container text-on-secondary-container">
                  {readyForCheckin.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('checkedIn')}
                className={`py-4 px-1 min-h-[48px] border-b-2 font-medium text-sm transition-[color,border-color,transform] duration-short2 ease-emphasized-standard active:scale-[0.98] ${
                  activeTab === 'checkedIn'
                    ? 'border-success text-success'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                }`}
              >
                Checked In
                <span className="ml-2 py-0.5 px-2 rounded-full text-sm bg-success-container text-on-success-container">
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
                      <h3 className="text-lg font-semibold text-on-surface">Attendees Ready for Check-in</h3>
                      {(() => {
                        const dateStatus = getEventDateStatus(currentEvent);
                        if (dateStatus && !dateStatus.canCheckIn) {
                          return (
                            <p className="text-sm text-warning mt-1 flex items-center">
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
                      <MagnifyingGlassIcon className="h-5 w-5 text-outline-variant" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, email, organization, phone, or registration ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent placeholder-gray-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Search results indicator */}
                  {searchQuery && readyForCheckin.length > 0 && (
                    <div className="mt-2 text-sm text-on-surface-variant">
                      Found <span className="font-semibold text-primary">{readyForCheckin.length}</span> attendee{readyForCheckin.length !== 1 ? 's' : ''} matching "{searchQuery}"
                    </div>
                  )}
                </div>
                
                {readyForCheckin.length === 0 ? (
                  <div className="text-center py-8">
                    {searchQuery ? (
                      <>
                        <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-outline-variant" />
                        <h3 className="mt-2 text-sm font-medium text-on-surface">No attendees found</h3>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          No attendees match your search "{searchQuery}"
                        </p>
                        <button
                          onClick={() => setSearchQuery('')}
                          className="mt-3 text-sm text-primary hover:text-on-secondary-container font-medium"
                        >
                          Clear search
                        </button>
                      </>
                    ) : (
                      <>
                        <UserGroupIcon className="mx-auto h-12 w-12 text-outline-variant" />
                        <h3 className="mt-2 text-sm font-medium text-on-surface">No attendees ready for check-in</h3>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          All approved and paid attendees have been checked in.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {readyForCheckin.map((registration) => (
                      <div key={registration.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-secondary-container rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {registration.attendee.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-on-surface">{registration.attendee.name}</p>
                            <p className="text-sm text-on-surface-variant">{registration.attendee.email}</p>
                            {registration.attendee.organization && (
                              <p className="text-sm text-outline-variant">{registration.attendee.organization}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleManualCheckin(registration.id)}
                          disabled={!canCheckIn}
                          title={!canCheckIn ? 'Check-in permission required' : undefined}
                          className="min-h-[48px] px-4 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success-hover active:scale-[0.97] transition-[color,background-color,transform] duration-short2 ease-emphasized-standard flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckIcon className="w-4 h-4" />
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
                    <h3 className="text-lg font-semibold text-on-surface">Checked In Attendees</h3>
                    <p className="text-sm text-on-surface-variant">{checkedIn.length} checked in</p>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-outline-variant" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, email, organization, phone, or registration ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-outline-variant rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Search results indicator */}
                  {searchQuery && checkedIn.length > 0 && (
                    <div className="mt-2 text-sm text-on-surface-variant">
                      Found <span className="font-semibold text-success">{checkedIn.length}</span> checked-in attendee{checkedIn.length !== 1 ? 's' : ''} matching "{searchQuery}"
                    </div>
                  )}
                </div>
                
                {checkedIn.length === 0 ? (
                  <div className="text-center py-8">
                    {searchQuery ? (
                      <>
                        <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-outline-variant" />
                        <h3 className="mt-2 text-sm font-medium text-on-surface">No attendees found</h3>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          No checked-in attendees match your search "{searchQuery}"
                        </p>
                        <button
                          onClick={() => setSearchQuery('')}
                          className="mt-3 text-sm text-success hover:text-on-success-container font-medium"
                        >
                          Clear search
                        </button>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="mx-auto h-12 w-12 text-outline-variant" />
                        <h3 className="mt-2 text-sm font-medium text-on-surface">No attendees checked in yet</h3>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          Checked in attendees will appear here.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {checkedIn.map((registration) => (
                      <div key={registration.id} className="flex items-center justify-between p-4 bg-success-container rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-success-container rounded-full flex items-center justify-center">
                            <CheckIcon className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="font-medium text-on-surface">{registration.attendee.name}</p>
                            <p className="text-sm text-on-surface-variant">{registration.attendee.email}</p>
                            {registration.attendee.organization && (
                              <p className="text-sm text-outline-variant">{registration.attendee.organization}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-success font-medium inline-flex items-center gap-1">
                            <CheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>Checked In</span>
                          </span>
                          <p className="text-sm text-on-surface-variant">Just now</p>
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

      {/* Kiosk Mode Onboarding & Setup Modal */}
      <KioskSetupModal
        open={isKioskSetupOpen}
        eventId={eventId}
        onLaunch={handleKioskLaunch}
        onCancel={() => setIsKioskSetupOpen(false)}
      />
    </>
  );

  return checkInContent;
};

export default CheckInTab;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAbility } from '@casl/react';
import {
  LockClosedIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  QrCodeIcon,
  CameraIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/20/solid';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { Result } from '@zxing/library';
import { EventService } from '../../../services/eventService';
import { RegistrationService } from '../../../services/registrationService';
import { Event, Registration as FirestoreRegistration } from '../../../types';
import { asRegistration } from '../../../auth/ability';
import { useAuth } from '../../../contexts/AuthContext';
import { useKioskPin } from '../../../hooks/useKioskPin';
import {
  useKioskCamera,
  getKioskCamera,
} from '../../../hooks/useKioskCamera';
import {
  playSuccessChime,
  playWarningBuzz,
  playClickFeedback,
} from '../../../utils/soundEffects';
import { logger } from '../../../utils/logger';
import { CameraService } from '../../../services/cameraService';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { LoadingSpinner, Button } from '../../../components/UI';
import KioskPinModal from './KioskPinModal';
import KioskSetupModal from '../../../components/KioskSetupModal';
import KioskWelcomeCard from './KioskWelcomeCard';
import KioskManualCodeModal from './KioskManualCodeModal';

const log = {
  debug: (...args: unknown[]) => logger.debug('[EventKioskPage]', ...args),
  info: (...args: unknown[]) => logger.info('[EventKioskPage]', ...args),
  warn: (...args: unknown[]) => logger.warn('[EventKioskPage]', ...args),
  error: (...args: unknown[]) => logger.error('[EventKioskPage]', ...args),
};

/** iPhone iOS exposes no element-fullscreen API; iPad and desktop engines do. */
const CAN_REQUEST_FULLSCREEN =
  typeof document !== 'undefined' && typeof document.documentElement?.requestFullscreen === 'function';

/** How long to wait for `loadedmetadata` after attaching a stream before playing anyway. */
const ATTACH_METADATA_TIMEOUT_MS = 350;

interface WelcomeData {
  attendeeName: string;
  organization?: string;
  ticketTierName?: string;
  eventTitle: string;
}

interface BannerFeedback {
  type: 'error' | 'warning';
  title: string;
  message: string;
}

export const EventKioskPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const ability = useAbility();
  const { userProfile } = useAuth();
  const isMobile = useMediaQuery('(max-width: 640px)');

  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<FirestoreRegistration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Camera state & configuration hook
  const { cameraConfig, setCameraConfig } = useKioskCamera(eventId);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Check-in and modal state
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);
  const [welcomeData, setWelcomeData] = useState<WelcomeData | null>(null);
  const [bannerFeedback, setBannerFeedback] = useState<BannerFeedback | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  // PIN Lock & Setup Modal state
  const { hasPin, setPin, verifyPin } = useKioskPin(eventId);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);

  // Exiting and starting concurrency guards
  const isExitingRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  // Monotonic token per startCamera attempt. A superseded attempt (modal
  // opened, newer attempt started) drops its own stream instead of
  // overwriting state or streams it no longer owns.
  const acquireEpochRef = useRef<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef<boolean>(false);

  // Ref-mirrors for long-lived async callbacks. The decode loop is armed once
  // per camera start and outlives many renders; reading render closures inside
  // it would judge a second attendee against the roster as it existed when the
  // camera started (masking duplicate check-ins). Everything a scanning or
  // fallback callback needs goes through a ref.
  const eventRef = useRef<Event | null>(event);
  const registrationsRef = useRef<FirestoreRegistration[]>(registrations);
  const cameraConfigRef = useRef(cameraConfig);
  const welcomeRef = useRef<WelcomeData | null>(null);
  const startCameraRef = useRef<(() => Promise<void>) | null>(null);
  const startScanningRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    eventRef.current = event;
  }, [event]);
  useEffect(() => {
    registrationsRef.current = registrations;
  }, [registrations]);
  useEffect(() => {
    cameraConfigRef.current = cameraConfig;
  }, [cameraConfig]);

  // Load event and scoped registrations
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!eventId) {
        setAuthError('Event ID is missing.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const eventData = await EventService.getEvent(eventId);
        if (!eventData) {
          if (isMounted) setAuthError('Event not found.');
          return;
        }

        // Verify authorization
        const canCheckIn = ability.can(
          'checkin',
          asRegistration({ organizerUid: eventData.organizer?.uid } as unknown as FirestoreRegistration)
        );

        if (!canCheckIn) {
          if (isMounted) {
            setAuthError('You do not have permission to operate check-in for this event.');
          }
          return;
        }

        if (isMounted) {
          setEvent(eventData);
        }

        // Fetch scoped registrations for in-memory lookup
        const regs = await RegistrationService.getEventRegistrations(eventId);
        if (isMounted) {
          setRegistrations(regs as FirestoreRegistration[]);
        }
      } catch (err) {
        log.error('Failed to load kiosk data:', err);
        if (isMounted) setAuthError('Failed to load event data. Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [eventId, ability]);

  // Prompt organizer to complete kiosk setup onboarding if not yet configured in this session
  useEffect(() => {
    if (!loading && !authError && event) {
      if (!hasPin) {
        setIsSetupModalOpen(true);
      }
    }
  }, [loading, authError, event, hasPin]);

  // Robust Camera Management with clean hardware release
  const stopCamera = useCallback(() => {
    isStartingRef.current = false;
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

    codeReaderRef.current = null;

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
        if (stream && stream.getTracks) {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
              track.enabled = false;
            } catch {
              // Ignore
            }
          });
        }
      }
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {
        // Ignore
      }
    }

    setIsCameraActive(false);
  }, []);

  /** Attach a stream to the kiosk video element and play it, WebKit-safe. */
  const attachStreamToVideo = useCallback(async (stream: MediaStream): Promise<boolean> => {
    console.log('[CameraService:Kiosk] attachStreamToVideo called with stream:', {
      id: stream.id,
      active: stream.active,
      tracks: stream.getVideoTracks().map((t) => ({
        id: t.id,
        label: t.label,
        readyState: t.readyState,
        enabled: t.enabled,
        muted: t.muted,
        settings: t.getSettings?.(),
      })),
    });

    // If video element is in the middle of a render transition, poll briefly for the ref
    let video = videoRef.current;
    if (!video) {
      console.warn('[CameraService:Kiosk] videoRef.current is null, polling...');
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (videoRef.current) {
          video = videoRef.current;
          console.log('[CameraService:Kiosk] videoRef.current resolved on frame', i);
          break;
        }
      }
    }
    if (!video) {
      console.error('[CameraService:Kiosk] videoRef.current could not be resolved in DOM');
      return false;
    }
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');
    try {
      await video.play();
      console.log('[CameraService:Kiosk] video.play() resolved successfully. Video status:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
      });
    } catch (playErr) {
      console.warn('[CameraService:Kiosk] video.play() notice:', playErr);
    }
    return true;
  }, []);

  // Wire the onended fallback: a live track dying (unplug, camera switching in
  // another app) must re-run acquisition with the organizer's facingMode
  // preserved and the now-dead deviceId dropped, so a disconnected device
  // never re-burns the 15s acquisition timeout.
  const wireTrackEnded = useCallback(
    (stream: MediaStream) => {
      const liveTrack = stream.getVideoTracks().find((t) => t.readyState === 'live');
      if (!liveTrack) return;
      liveTrack.onended = () => {
        if (isExitingRef.current) return;
        console.warn('[CameraService:Kiosk] Active camera track ended (wired connection disconnected). Falling back to OS default...');
        setCameraConfig({
          facingMode: cameraConfigRef.current?.facingMode || 'user',
          deviceId: undefined,
        });
        void startCameraRef.current?.();
      };
    },
    [setCameraConfig]
  );

  // Robust Camera Management: let the OS and browser negotiate cleanly via CameraService
  const startCamera = useCallback(async () => {
    console.log('[CameraService:Kiosk] startCamera invoked', {
      isExiting: isExitingRef.current,
      isStarting: isStartingRef.current,
      loading,
      authError,
      isPinModalOpen,
      isSetupModalOpen,
      acquireEpoch: acquireEpochRef.current,
    });

    if (isExitingRef.current || isStartingRef.current) {
      console.log('[CameraService:Kiosk] startCamera ignored: already exiting or starting');
      return;
    }
    // A modal owns the camera: fire-and-forget triggers (devicechange,
    // mount race) must not duel with the preview the organizer is looking at.
    if (loading || !!authError || isPinModalOpen || isSetupModalOpen) {
      console.log('[CameraService:Kiosk] startCamera ignored: camera is blocked by active modal/loading');
      return;
    }
    isStartingRef.current = true;
    const epoch = ++acquireEpochRef.current;
    setCameraError(null);

    try {
      // Secure-origin gate: a plain http:// venue LAN exposes no
      // navigator.mediaDevices and needs guidance, not a cryptic TypeError.
      const support = CameraService.supportsKioskCamera();
      if (support) {
        console.error('[CameraService:Kiosk] supportsKioskCamera failure:', support);
        setCameraError(support.message);
        setIsCameraActive(false);
        return;
      }

      // Settle delay lets previous tracks fully release in the OS before re-acquiring
      await new Promise((res) => setTimeout(res, 250));
      if (isExitingRef.current) return;

      // sessionStorage is written synchronously by every writer, so it is
      // always fresher than the closure snapshot of cameraConfig.
      const storedConfig = getKioskCamera(eventId) || cameraConfigRef.current;
      const activeDeviceId = storedConfig?.deviceId;
      const activeFacingMode = storedConfig?.facingMode || 'user';

      console.log('[CameraService:Kiosk] calling CameraService.acquireKioskStream with:', {
        eventId,
        storedConfig,
        activeDeviceId,
        activeFacingMode,
        isMobile,
      });

      // Standard acquisition ladder handled by the OS
      const { stream, deviceId } = await CameraService.acquireKioskStream(
        { deviceId: activeDeviceId, facingMode: activeFacingMode },
        {
          timeoutMs: 15000,
          preferOsDefault: !isMobile && !activeDeviceId,
          deviceIdExact: false,
          onFallback: (stage, err) => console.warn('[CameraService:Kiosk] Camera ladder fallback:', stage, err),
        }
      );

      console.log('[CameraService:Kiosk] acquireKioskStream returned:', {
        negotiatedDeviceId: deviceId,
        streamId: stream.id,
        epoch,
        currentEpoch: acquireEpochRef.current,
      });

      // Superseded: the kiosk is exiting, a modal reclaimed the camera, or
      // a newer attempt owns the pipeline. Drop our own stream quietly.
      if (
        isExitingRef.current ||
        isPinModalOpen ||
        isSetupModalOpen ||
        acquireEpochRef.current !== epoch
      ) {
        console.warn('[CameraService:Kiosk] Stream dropped: superseded or modal opened while acquiring', {
          isExiting: isExitingRef.current,
          isPinModalOpen,
          isSetupModalOpen,
          epochMatch: acquireEpochRef.current === epoch,
        });
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {
            // Ignore
          }
        });
        return;
      }

      const attached = await attachStreamToVideo(stream);
      console.log('[CameraService:Kiosk] attachStreamToVideo returned:', attached);
      if (!attached) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch {
            // Ignore
          }
        });
        setCameraError('Unable to attach video feed to viewfinder. Please tap Retry Camera.');
        setIsCameraActive(false);
        return;
      }
      streamRef.current = stream;
      setIsCameraActive(true);
      console.log('[CameraService:Kiosk] Camera active! isCameraActive set to true');
      wireTrackEnded(stream);
      void startScanningRef.current?.();
    } catch (err) {
      console.error('[CameraService:Kiosk] Camera access error in kiosk:', err);
      if (isExitingRef.current) return;
      // Typed failure copy: names the real cause (permission, jammed camera,
      // dead device, secure origin) and the engine-specific way to unblock.
      setCameraError(CameraService.describeCameraFailure(err).message);
      setIsCameraActive(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [attachStreamToVideo, wireTrackEnded, eventId, isMobile, loading, authError, isPinModalOpen, isSetupModalOpen]);

  // Stable handle for onended fallback paths: async copies call the newest
  // closure without creating a circular hook dependency.
  startCameraRef.current = startCamera;

  // Auto-detect when external cameras are plugged in, unplugged, or reconnected
  useEffect(() => {
    const handleDeviceChange = () => {
      log.info('Media device change detected in kiosk');
      // If camera was disconnected or failed, retry automatically when a device is plugged in
      if (!isCameraActive && !isExitingRef.current) {
        void startCamera();
      }
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [isCameraActive, startCamera]);

  // Quick-action to clear custom deviceId and fall back to default camera
  const handleUseDefaultCamera = useCallback(() => {
    playClickFeedback();
    setCameraConfig({
      facingMode: cameraConfigRef.current?.facingMode || 'user',
      deviceId: undefined,
    });
    setCameraError(null);
    startCameraRef.current?.();
  }, [setCameraConfig]);

  // Stop camera when unmounting, and reset exiting flag on mount (StrictMode safe)
  useEffect(() => {
    isExitingRef.current = false;
    return () => {
      isExitingRef.current = true;
      stopCamera();
    };
  }, [stopCamera]);

  // Camera lifecycle single-owner effect. Start when the kiosk surface is
  // ready and no blocking modal is up; stop only when a modal pins the page.
  useEffect(() => {
    if (isExitingRef.current) return;
    if (loading || authError || isPinModalOpen || isSetupModalOpen) {
      stopCamera();
      return;
    }
    // A healthy stream is never torn down by an incidental state change; all
    // intentional camera changes call startCamera themselves. The cameraError
    // gate keeps a persistent failure (denied permission) from looping.
    if (!isCameraActive && !cameraError) {
      void startCamera();
    }
  }, [
    loading,
    authError,
    isPinModalOpen,
    isSetupModalOpen,
    isCameraActive,
    cameraError,
    startCamera,
    stopCamera,
  ]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    playClickFeedback();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Fullscreen request might be blocked by browser policy
      });
    } else {
      document.exitFullscreen?.().catch(() => {
        // Exit request ignore
      });
    }
  };

  // Welcome-card transition: the camera stream STAYS LIVE behind the card and
  // only the scanner pauses, so the next attendee resumes scanning instantly
  // instead of paying the camera acquisition delay again.
  const pushWelcome = useCallback((data: WelcomeData) => {
    welcomeRef.current = data;
    setWelcomeData(data);
  }, []);

  // Perform check-in logic. Reads snapshot refs, not render closures: the scan
  // callback outlives renders, and a fresh check-in must update the roster the
  // NEXT scan reads.
  const processCheckIn = async (
    lookupValue: string
  ): Promise<{ success: boolean; message?: string }> => {
    const currentEvent = eventRef.current;
    if (!lookupValue || !currentEvent) return { success: false, message: 'Invalid check-in request.' };
    const clean = lookupValue.trim();

    // Find registration in local cache
    const reg = registrationsRef.current.find((r) => {
      if (clean.startsWith('registration:') && r.id === clean.replace('registration:', '')) {
        return true;
      }
      if (r.qrCode && r.qrCode === clean) return true;
      if (r.id.toLowerCase() === clean.toLowerCase()) return true;
      if (r.userDetails?.email?.toLowerCase() === clean.toLowerCase()) return true;
      if (r.paymentDetails?.transactionId?.toLowerCase() === clean.toLowerCase()) return true;
      return false;
    });

    if (!reg) {
      playWarningBuzz();
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      const message =
        'Could not find a valid registration for this QR code, email, or reference. Please check with registration staff.';
      setBannerFeedback({
        type: 'error',
        title: 'Registration Not Found',
        message,
      });
      setTimeout(() => setBannerFeedback(null), 4000);
      return { success: false, message };
    }

    // Check if already checked in
    if (reg.attendanceStatus === 'checked-in') {
      playWarningBuzz();
      if ('vibrate' in navigator) navigator.vibrate([100, 100, 100]);
      const message = `${reg.userDetails?.name || 'Attendee'} was already checked in.`;
      setBannerFeedback({
        type: 'warning',
        title: 'Already Checked In',
        message,
      });
      setTimeout(() => setBannerFeedback(null), 4000);
      return { success: false, message };
    }

    // Verify payment for paid events
    if (reg.paymentStatus !== 'paid' && (reg.totalAmount ?? 0) > 0) {
      playWarningBuzz();
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      const message = `${reg.userDetails?.name || 'Attendee'} has a pending payment. Please proceed to the payment counter.`;
      setBannerFeedback({
        type: 'error',
        title: 'Payment Pending',
        message,
      });
      setTimeout(() => setBannerFeedback(null), 5000);
      return { success: false, message };
    }

    try {
      setIsCheckingIn(true);
      await RegistrationService.checkInAttendee(reg.id, 'qr', true);

      // Success! Play synthesized chime and trigger haptic
      playSuccessChime();
      if ('vibrate' in navigator) navigator.vibrate(200);

      // Update in-memory registrations
      setRegistrations((prev) =>
        prev.map((item) =>
          item.id === reg.id ? { ...item, attendanceStatus: 'checked-in' as const } : item
        )
      );

      // Find ticket tier name
      const ticketTier = currentEvent.ticketTypes?.find((t) => t.id === reg.ticketTypeId);

      pushWelcome({
        attendeeName: reg.userDetails?.name || 'Attendee',
        organization: reg.userDetails?.organization,
        ticketTierName: ticketTier?.name,
        eventTitle: currentEvent.title,
      });

      return { success: true };
    } catch (err) {
      log.error('Check-in execution error:', err);
      playWarningBuzz();
      const message = err instanceof Error ? err.message : 'An error occurred during check-in.';
      setBannerFeedback({
        type: 'error',
        title: 'Check-In Error',
        message,
      });
      setTimeout(() => setBannerFeedback(null), 4000);
      return { success: false, message };
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Continuous QR Scanner Loop using decodeFromVideoElement
  const startScanningLoop = async () => {
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
            const qrText = result.getText();
            log.info('Detected QR code:', qrText);

            // Stop scanning while processing
            scanningRef.current = false;
            setIsScanning(false);

            await processCheckIn(qrText);

            // Wait before re-enabling scanning to avoid rapid duplicates
            setTimeout(() => {
              if (!isExitingRef.current && !welcomeRef.current) {
                scanningRef.current = true;
                setIsScanning(true);
              }
            }, 2500);
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

  // Stable dispatch handle consumed by startCamera through a ref, keeping the
  // hook dependency graph acyclic without lint suppressions.
  startScanningRef.current = startScanningLoop;

  const resumeScanning = useCallback(async () => {
    if (isExitingRef.current || welcomeRef.current) return;
    const stream = streamRef.current;
    if (stream?.active && stream.getVideoTracks().some((t) => t.readyState === 'live')) {
      if (videoRef.current) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        if (videoRef.current.paused) {
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('[CameraService:Kiosk] video.play() on resume notice:', playErr);
          }
        }
      }
      setIsCameraActive(true);
      scanningRef.current = true;
      setIsScanning(true);
      if (!scannerControlsRef.current) {
        void startScanningRef.current?.();
      }
      return;
    }
    void startCameraRef.current?.();
  }, []);

  const handleWelcomeDismiss = useCallback(() => {
    welcomeRef.current = null;
    setWelcomeData(null);
    void resumeScanning();
  }, [resumeScanning]);

  // Exit Kiosk handlers
  const handleExitClick = () => {
    playClickFeedback();
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    // Correct PIN verified! Exit to workspace check-in tab
    isExitingRef.current = true;
    stopCamera();
    setIsPinModalOpen(false);
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    navigate(`/events/${eventId}/check-in`);
  };

  const handlePinCancel = () => {
    setIsPinModalOpen(false);
  };

  // Setup onboarding handlers: closing the modal allows startCamera to acquire the configured camera from the OS
  const handleSetupLaunch = (config: {
    pin: string;
    deviceId?: string;
    facingMode: 'user' | 'environment';
  }) => {
    isExitingRef.current = false;
    setPin(config.pin);
    setCameraConfig({
      deviceId: config.deviceId,
      facingMode: config.facingMode,
    });
    setCameraError(null);
    setIsSetupModalOpen(false);
  };

  const handleSetupCancel = () => {
    isExitingRef.current = true;
    stopCamera();
    setIsSetupModalOpen(false);
    navigate(`/events/${eventId}/check-in`);
  };

  // Stats calculation
  const totalRegistrations = registrations.length;
  const checkedInCount = useMemo(
    () => registrations.filter((r) => r.attendanceStatus === 'checked-in').length,
    [registrations]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col items-center justify-center p-6 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm font-medium text-on-surface-variant animate-pulse">
          Initializing Self-Check-In Kiosk...
        </p>
      </div>
    );
  }

  if (authError || !event) {
    return (
      <div className="min-h-screen bg-surface-container-low flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mb-4">
          <ExclamationCircleIcon className="w-10 h-10" />
        </div>
        <h1 className="text-xl font-bold text-on-surface mb-2">Access Denied</h1>
        <p className="text-sm text-on-surface-variant max-w-md mb-6">{authError}</p>
        <Button variant="filled" onClick={() => navigate(eventId ? `/events/${eventId}` : '/')}>
          Return to Workspace
        </Button>
      </div>
    );
  }

  const bannerImage = event.bannerUrl || event.imageUrl;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-between select-none overflow-hidden relative">
      {/* Event Banner Atmospheric Backdrop */}
      {bannerImage ? (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden z-0"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 opacity-30 transform transition-opacity duration-700"
            style={{ backgroundImage: `url(${bannerImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface/30 via-transparent to-surface/40 backdrop-blur-[0.5px]" />
        </div>
      ) : (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-gradient-to-br from-primary/15 via-surface/60 to-secondary/15 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      {/* Kiosk Header */}
      <header className="relative px-4 py-3 sm:px-6 sm:py-4 border-b border-outline-variant/60 bg-surface/85 backdrop-blur-xl flex items-center justify-between z-10 shadow-sm">
        {/* Google 4-Color Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="h-full w-1/4 bg-[#4285F4]" />
          <div className="h-full w-1/4 bg-[#EA4335]" />
          <div className="h-full w-1/4 bg-[#FBBC04]" />
          <div className="h-full w-1/4 bg-[#34A853]" />
        </div>

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0 ring-2 ring-white/50">
            {event.title.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-on-surface truncate">
              {event.title}
            </h1>
            <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="font-medium">Self-Check-In Station</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Checked-in counter badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success-container/90 backdrop-blur-sm text-on-success-container border border-success/30 text-xs font-semibold shadow-sm">
            <CheckCircleIcon className="w-4 h-4 text-success" />
            <span>
              {checkedInCount} / {totalRegistrations} Checked In
            </span>
          </div>

          {/* Fullscreen Toggle (element-fullscreen is absent on iPhone iOS) */}
          {CAN_REQUEST_FULLSCREEN && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl border border-outline-variant/80 bg-surface/80 backdrop-blur-sm hover:bg-surface-container-low text-on-surface-variant transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shadow-sm"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="w-5 h-5" />
              ) : (
                <ArrowsPointingOutIcon className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Organizer Exit Kiosk Button (PIN Protected) */}
          <button
            type="button"
            onClick={handleExitClick}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-outline-variant/80 bg-surface/80 backdrop-blur-sm hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors min-h-[44px] font-medium text-xs sm:text-sm shadow-sm"
            title="Exit Kiosk Mode"
          >
            <LockClosedIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Exit Kiosk</span>
          </button>
        </div>
      </header>

      {/* Main Kiosk Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative">
        {/* Banner Feedback Alert (Temporary error or warning) */}
        {bannerFeedback && (
          <div
            role="alert"
            className={`absolute top-4 inset-x-4 max-w-lg mx-auto z-20 rounded-2xl p-4 shadow-xl border animate-pop-in motion-reduce:animate-none ${
              bannerFeedback.type === 'error'
                ? 'bg-error-container text-on-error-container border-error/30'
                : 'bg-warning-container text-on-warning-container border-warning/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">{bannerFeedback.title}</h4>
                <p className="text-xs sm:text-sm mt-0.5 opacity-90">{bannerFeedback.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* View Mode: Celebratory Card overlay over the active camera viewfinder */}
        {welcomeData && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-surface-container/60 backdrop-blur-md animate-pop-in motion-reduce:animate-none">
            <KioskWelcomeCard
              attendeeName={welcomeData.attendeeName}
              organization={welcomeData.organization}
              ticketTierName={welcomeData.ticketTierName}
              eventTitle={welcomeData.eventTitle}
              onDismiss={handleWelcomeDismiss}
            />
          </div>
        )}

        <div className="w-full max-w-md flex flex-col items-center">
            {/* Camera Viewfinder Card with Glassmorphic Frame */}
            <div className="w-full bg-surface/85 backdrop-blur-xl rounded-3xl overflow-hidden border-2 border-outline-variant/80 shadow-2xl relative aspect-[4/3] flex items-center justify-center ring-1 ring-white/40">
              {/* Feed cross-fades in over the status overlay, so the handoff
                  from the setup modal preview or a fresh acquire reads as one
                  continuous viewfinder instead of a hard content swap. */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {!isCameraActive && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-surface-container/90 backdrop-blur-md"
                >
                  <CameraIcon className="w-14 h-14 text-outline-variant mb-3 animate-pulse" />
                  <p className="text-sm font-medium text-on-surface-variant max-w-xs">
                    {cameraError || 'Starting Camera...'}
                  </p>
                  {cameraError ? (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="tonal"
                        size="sm"
                        onClick={() => void startCamera()}
                      >
                        Retry Camera
                      </Button>
                      <Button
                        variant="outlined"
                        size="sm"
                        onClick={handleUseDefaultCamera}
                      >
                        Use Default Camera
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => setIsSetupModalOpen(true)}
                      >
                        Station Setup
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant/70 mt-1 max-w-xs">
                      Connecting camera feed...
                    </p>
                  )}
                </div>
              )}

              {/* Scanning Target Overlay */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-56 h-56 border-2 rounded-2xl transition-colors duration-200 relative ${
                      isScanning ? 'border-primary/60' : 'border-success'
                    }`}
                  >
                    {/* Animated Laser Scanline scrolling within the frame */}
                    {isScanning && (
                      <div className="absolute inset-0 overflow-hidden rounded-[14px] pointer-events-none">
                        <div className="w-full h-full flex flex-col justify-end animate-scanline motion-reduce:hidden">
                          <div className="relative w-full flex items-center justify-center">
                            <div className="absolute w-full h-6 bg-gradient-to-r from-transparent via-[#4285F4]/30 to-transparent blur-sm pointer-events-none" />
                            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#4285F4] to-transparent shadow-[0_0_12px_2px_rgba(66,133,244,0.85)] pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Google 4-Color Corner Reticle Accents */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#4285F4] rounded-tl-lg shadow-[0_0_8px_rgba(66,133,244,0.6)]" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#EA4335] rounded-tr-lg shadow-[0_0_8px_rgba(234,67,53,0.6)]" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#FBBC04] rounded-br-lg shadow-[0_0_8px_rgba(251,188,4,0.6)]" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#34A853] rounded-bl-lg shadow-[0_0_8px_rgba(52,168,83,0.6)]" />
                  </div>
                </div>
              )}

            </div>

            {/* Glassmorphic Instruction Banner */}
            <div className="mt-5 text-center space-y-1 px-5 py-3 rounded-2xl bg-surface/80 backdrop-blur-md border border-outline-variant/60 shadow-md">
              <h2 className="text-lg font-bold text-on-surface flex items-center justify-center gap-2">
                <span>Hold Badge QR to Camera</span>
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-xs mx-auto">
                Align your attendee QR code within the frame to verify check-in instantly.
              </p>
            </div>

            {/* Manual Code Fallback Button */}
            <div className="mt-4 w-full max-w-xs">
              <Button
                variant="outlined"
                size="lg"
                icon={<QrCodeIcon className="w-5 h-5" />}
                className="w-full min-h-[50px] font-semibold text-sm bg-surface/80 backdrop-blur-md border-outline-variant/80 hover:bg-surface-container-low shadow-sm"
                onClick={() => {
                  playClickFeedback();
                  setIsManualModalOpen(true);
                }}
              >
                Enter Code Manually
              </Button>
            </div>
          </div>
      </main>

      {/* Kiosk Footer */}
      <footer className="px-4 py-3 border-t border-outline-variant text-center bg-surface text-xs text-on-surface-variant flex items-center justify-between sm:justify-center relative">
        <span className="sm:hidden text-xs font-semibold text-success">
          {checkedInCount} / {totalRegistrations} Checked In
        </span>
        <span className="text-center">TeamApo Hub · GDG Davao Event Kiosk</span>
        <div className="w-8 sm:hidden" />
      </footer>

      {/* Kiosk Setup Onboarding Modal */}
      <KioskSetupModal
        open={isSetupModalOpen}
        eventId={eventId || ''}
        onLaunch={handleSetupLaunch}
        onCancel={handleSetupCancel}
      />

      {/* Exit Kiosk Verification Modal */}
      <KioskPinModal
        open={isPinModalOpen}
        mode="verify"
        onSuccess={handlePinSuccess}
        onCancel={handlePinCancel}
        verifyPin={verifyPin}
      />

      {/* Manual Check-in Modal */}
      <KioskManualCodeModal
        open={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={async (code) => {
          const result = await processCheckIn(code);
          if (result.success) {
            setIsManualModalOpen(false);
            return true;
          }
          return result.message || false;
        }}
        isLoading={isCheckingIn}
      />
    </div>
  );
};

export default EventKioskPage;

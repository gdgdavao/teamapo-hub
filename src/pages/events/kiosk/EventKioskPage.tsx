import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAbility } from '@casl/react';
import {
  LockClosedIcon,
  QrCodeIcon,
  CameraIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
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
import usePageTitle from '../../../hooks/usePageTitle';

const log = {
  debug: (...args: unknown[]) => logger.debug('[EventKioskPage]', ...args),
  info: (...args: unknown[]) => logger.info('[EventKioskPage]', ...args),
  warn: (...args: unknown[]) => logger.warn('[EventKioskPage]', ...args),
  error: (...args: unknown[]) => logger.error('[EventKioskPage]', ...args),
};

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

  usePageTitle({
    title: 'Check-In Kiosk',
    contextTitle: event?.title,
  });

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
    log.debug('attachStreamToVideo called with stream:', {
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
      log.warn('videoRef.current is null, polling...');
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (videoRef.current) {
          video = videoRef.current;
          log.debug('videoRef.current resolved on frame', i);
          break;
        }
      }
    }
    if (!video) {
      log.error('videoRef.current could not be resolved in DOM');
      return false;
    }
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');
    try {
      await video.play();
      log.debug('video.play() resolved successfully. Video status:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
      });
    } catch (playErr) {
      log.warn('video.play() notice:', playErr);
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
        log.warn('Active camera track ended (wired connection disconnected). Falling back to OS default...');
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
    log.debug('startCamera invoked', {
      isExiting: isExitingRef.current,
      isStarting: isStartingRef.current,
      loading,
      authError,
      isPinModalOpen,
      isSetupModalOpen,
      acquireEpoch: acquireEpochRef.current,
    });

    if (isExitingRef.current || isStartingRef.current) {
      log.debug('startCamera ignored: already exiting or starting');
      return;
    }
    // A modal owns the camera: fire-and-forget triggers (devicechange,
    // mount race) must not duel with the preview the organizer is looking at.
    if (loading || !!authError || isPinModalOpen || isSetupModalOpen) {
      log.debug('startCamera ignored: camera is blocked by active modal/loading');
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
        log.error('supportsKioskCamera failure:', support);
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

      log.debug('calling CameraService.acquireKioskStream with:', {
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
          onFallback: (stage, err) => log.warn('Camera ladder fallback:', stage, err),
        }
      );

      log.debug('acquireKioskStream returned:', {
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
        log.warn('Stream dropped: superseded or modal opened while acquiring', {
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
      log.debug('attachStreamToVideo returned:', attached);
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
      log.debug('Camera active! isCameraActive set to true');
      wireTrackEnded(stream);
      void startScanningRef.current?.();
    } catch (err) {
      log.error('Camera access error in kiosk:', err);
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

    setIsCheckingIn(true);
    try {
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
            log.warn('video.play() on resume notice:', playErr);
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

  if (loading) {
    return (
      <div className="min-h-page kiosk-google-dark-bg text-inverse-on-surface flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div
          className="pointer-events-none absolute -inset-16 kiosk-google-mesh-layer z-0"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm font-medium text-inverse-on-surface/80 animate-pulse">
            Initializing Self-Check-In Kiosk...
          </p>
        </div>
      </div>
    );
  }

  if (authError || !event) {
    return (
      <div className="min-h-page kiosk-google-dark-bg text-inverse-on-surface flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div
          className="pointer-events-none absolute -inset-16 kiosk-google-mesh-layer z-0"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mb-4">
            <ExclamationCircleIcon className="w-10 h-10" />
          </div>
          <h1 className="text-xl font-bold text-inverse-on-surface mb-2">Access Denied</h1>
          <p className="text-sm text-inverse-on-surface/80 max-w-md mb-6">{authError}</p>
          <Button variant="filled" onClick={() => navigate(eventId ? `/events/${eventId}` : '/')}>
            Return to Workspace
          </Button>
        </div>
      </div>
    );
  }

  const sponsors = event.sponsors ?? [];
  const tickerRepeatCount = sponsors.length > 0 ? Math.max(2, Math.ceil(8 / sponsors.length)) : 0;
  const tickerTrackItems =
    tickerRepeatCount > 0
      ? Array.from({ length: tickerRepeatCount }, () => sponsors).flat()
      : [];

  return (
    <div className="min-h-page kiosk-google-dark-bg text-inverse-on-surface flex flex-col justify-between select-none overflow-hidden relative">
      {/* Animated Dark Mixed Google Colors Ambient Mesh Layers */}
      <div
        className="pointer-events-none absolute -inset-24 kiosk-google-mesh-layer z-0"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -inset-24 kiosk-google-mesh-layer-fast z-0"
        aria-hidden="true"
      />

      {/* Kiosk Header — Minimal bar with 4-color top accent and Exit Kiosk button */}
      <header className="relative px-4 py-3 sm:px-8 sm:py-4 flex items-center justify-end z-10">
        {/* Google 4-Color Accent Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="h-full w-1/4 bg-[#4285F4]" />
          <div className="h-full w-1/4 bg-[#EA4335]" />
          <div className="h-full w-1/4 bg-[#FBBC04]" />
          <div className="h-full w-1/4 bg-[#34A853]" />
        </div>

        {/* Organizer Exit Kiosk Button (PIN Protected) */}
        <button
          type="button"
          onClick={handleExitClick}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 text-inverse-on-surface transition-colors min-h-control font-medium text-xs sm:text-sm"
          title="Exit Kiosk Mode"
        >
          <LockClosedIcon className="w-4 h-4" />
          <span>Exit Kiosk</span>
        </button>
      </header>

      {/* Main Two-Column Kiosk Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:px-8 sm:py-10 relative z-10">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Greetings & Hero Event Title (or Celebratory Welcome Card on Check-In) */}
          <section
            aria-label="Event Greeting and Check-In Status"
            className="lg:col-span-7 flex flex-col items-start text-left space-y-5"
          >
            {welcomeData ? (
              <KioskWelcomeCard
                attendeeName={welcomeData.attendeeName}
                organization={welcomeData.organization}
                ticketTierName={welcomeData.ticketTierName}
                eventTitle={welcomeData.eventTitle}
                onDismiss={handleWelcomeDismiss}
              />
            ) : (
              <>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-inverse-on-surface ring-1 ring-inset ring-white/20 backdrop-blur-sm text-xs sm:text-sm font-bold uppercase tracking-wider">
                  <span>Welcome to</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-inverse-on-surface tracking-tight leading-[1.12] break-words max-w-2xl">
                  {event.title}
                </h1>

                <p className="text-base sm:text-lg text-inverse-on-surface/80 leading-relaxed max-w-xl">
                  Hold your attendee QR code up to the camera scanner to check in right away, or use your registration reference code below the camera.
                </p>

                {/* Google 4-color accent bar */}
                <div className="flex items-center gap-2 pt-1" aria-hidden="true">
                  <span className="h-1.5 w-10 rounded-full bg-[#4285F4]" />
                  <span className="h-1.5 w-6 rounded-full bg-[#EA4335]" />
                  <span className="h-1.5 w-6 rounded-full bg-[#FBBC04]" />
                  <span className="h-1.5 w-6 rounded-full bg-[#34A853]" />
                </div>

                {/* Banner Feedback Alert (Temporary error or warning) */}
                {bannerFeedback && (
                  <div
                    role="alert"
                    className={`w-full max-w-xl rounded-2xl p-4 border shadow-elevation-2 animate-pop-in motion-reduce:animate-none ${
                      bannerFeedback.type === 'error'
                        ? 'bg-error-container text-on-error-container border-error/30'
                        : 'bg-warning-container text-on-warning-container border-warning/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <ExclamationCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />
                      <div>
                        <h2 className="text-sm font-bold">{bannerFeedback.title}</h2>
                        <p className="text-xs sm:text-sm mt-0.5 opacity-90">
                          {bannerFeedback.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Right Column: Frameless Camera Scanner & Manual Entry */}
          <section
            aria-label="QR Code Camera Scanner"
            className="lg:col-span-5 flex flex-col items-center w-full max-w-md mx-auto lg:max-w-none"
          >
            {/* Frameless Camera Viewfinder Container */}
            <div className="w-full bg-inverse-surface/80 rounded-3xl overflow-hidden border border-white/20 shadow-[0_24px_60px_rgba(0,0,0,0.45)] relative aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {isCameraActive && isCheckingIn && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-inverse-surface/75 backdrop-blur-md animate-fade-in motion-reduce:animate-none"
                >
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-base sm:text-lg font-bold text-inverse-on-surface">
                    Verifying QR Code...
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-inverse-on-surface/80">
                    Please hold still while we process your check-in
                  </p>
                </div>
              )}

              {!isCameraActive && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-inverse-surface/95 backdrop-blur-md"
                >
                  <CameraIcon className="w-14 h-14 text-inverse-on-surface/50 mb-3 animate-pulse" />
                  <p className="text-sm font-medium text-inverse-on-surface max-w-xs">
                    {cameraError || 'Starting Camera...'}
                  </p>
                  {cameraError ? (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="filled"
                        size="sm"
                        onClick={() => void startCamera()}
                      >
                        Retry Camera
                      </Button>
                      <Button
                        variant="tonal"
                        size="sm"
                        onClick={handleUseDefaultCamera}
                      >
                        Use Default Camera
                      </Button>
                      <Button
                        variant="tonal"
                        size="sm"
                        onClick={() => setIsSetupModalOpen(true)}
                      >
                        Station Setup
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-inverse-on-surface/70 mt-1 max-w-xs">
                      Connecting camera feed...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Scanner Status & Manual Code Fallback */}
            <div className="mt-4 w-full flex flex-col items-center gap-3">
              <p className="text-xs sm:text-sm font-medium text-inverse-on-surface/85 flex items-center gap-2">
                {isCheckingIn ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      isCameraActive && isScanning ? 'bg-success' : 'bg-outline'
                    }`}
                  />
                )}
                <span>
                  {isCheckingIn
                    ? 'Verifying check-in...'
                    : isCameraActive
                      ? isScanning
                        ? 'Camera ready — show your QR code'
                        : 'Processing scan...'
                      : 'Waiting for camera...'}
                </span>
              </p>

              <button
                type="button"
                disabled={isCheckingIn}
                onClick={() => {
                  playClickFeedback();
                  setIsManualModalOpen(true);
                }}
                className="w-full min-h-control inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white text-on-surface hover:bg-surface-container-low font-bold text-sm sm:text-base shadow-elevation-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-[background-color,transform,box-shadow] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-surface"
              >
                <QrCodeIcon className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
                <span>Enter Code Manually</span>
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Dock: Sponsors & Partners Scrolling Ticker (Transparent, No Background) */}
      {sponsors.length > 0 && (
        <section
          aria-label="Event Sponsors and Partners"
          className="w-full py-4 overflow-hidden z-10"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-inverse-on-surface/70">
              Sponsors &amp; Partners
            </span>
          </div>

          <div className="relative w-full overflow-hidden">
            <div className="flex w-max animate-kiosk-ticker">
              {[0, 1].map((groupIndex) => (
                <div
                  key={groupIndex}
                  aria-hidden={groupIndex === 1 ? 'true' : undefined}
                  className="flex shrink-0 items-center gap-12 pr-12"
                >
                  {tickerTrackItems.map((sponsor, idx) => (
                    <div
                      key={`${groupIndex}-${sponsor.id}-${idx}`}
                      className="flex items-center justify-center shrink-0"
                    >
                      <img
                        src={sponsor.logoUrl}
                        alt={groupIndex === 0 ? sponsor.name : ''}
                        loading="lazy"
                        decoding="async"
                        className="h-auto max-h-12 sm:max-h-14 w-auto object-contain"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComputerDesktopIcon,
  VideoCameraIcon,
  ArrowPathIcon,
  KeyIcon,
  BackspaceIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Modal, Button, Select, Badge } from './UI';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useKioskPin } from '../hooks/useKioskPin';
import {
  useKioskCamera,
  KioskCameraConfig,
} from '../hooks/useKioskCamera';
import { CameraService } from '../services/cameraService';
import { playClickFeedback, playWarningBuzz } from '../utils/soundEffects';
import log from '../utils/logger';

export interface KioskSetupModalProps {
  open: boolean;
  eventId: string;
  onLaunch: (config: {
    pin: string;
    deviceId?: string;
    facingMode: 'user' | 'environment';
  }) => void;
  onCancel: () => void;
}

export const KioskSetupModal: React.FC<KioskSetupModalProps> = ({
  open,
  eventId,
  onLaunch,
  onCancel,
}) => {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const { hasPin, getPin, setPin } = useKioskPin(eventId);
  const { cameraConfig, setCameraConfig } = useKioskCamera(eventId);

  // Camera state
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
    cameraConfig?.deviceId
  );
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    cameraConfig?.facingMode || 'user'
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  // PIN state
  const [pin, setLocalPin] = useState<string>('');
  const [isChangingPin, setIsChangingPin] = useState<boolean>(!hasPin);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const isUnmountedRef = useRef<boolean>(false);
  const acquisitionSeqRef = useRef<number>(0);

  // Stop camera preview tracks
  const stopPreviewStream = useCallback(() => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {
          // Ignore
        }
      });
      previewStreamRef.current = null;
    }
    if (previewVideoRef.current) {
      try {
        previewVideoRef.current.pause();
        previewVideoRef.current.srcObject = null;
      } catch {
        // Ignore
      }
    }
    setIsPreviewActive(false);
  }, []);

  // Enumerate available video input devices (empty-id virtual devices filtered out)
  const refreshDevices = useCallback(async () => {
    setVideoDevices(await CameraService.listVideoInputs());
  }, []);

  // Start preview with specified or current constraints
  const startPreview = useCallback(
    async (targetDeviceId?: string, targetFacingMode?: 'user' | 'environment') => {
      if (isUnmountedRef.current) return;

      const deviceId = targetDeviceId !== undefined ? targetDeviceId : selectedDeviceId;
      const facing = targetFacingMode || facingMode;

      // Gate early on the WebRTC stack: a non-secure origin (plain http:// LAN)
      // exposes no navigator.mediaDevices and would otherwise die as a cryptic
      // TypeError deep inside the ladder.
      const support = CameraService.supportsKioskCamera();
      if (support) {
        setCameraError(support.message);
        setIsPreviewActive(false);
        return;
      }

      // Ponytail optimization: If the active stream is already live and matches the requested device, keep it!
      const videoTracks = previewStreamRef.current?.getVideoTracks
        ? previewStreamRef.current.getVideoTracks()
        : previewStreamRef.current?.getTracks?.() || [];
      const activeTrack = videoTracks.find((t) => t.readyState === 'live');
      if (activeTrack && previewVideoRef.current?.srcObject) {
        const currentTrackDeviceId = activeTrack.getSettings()?.deviceId;
        if (deviceId && currentTrackDeviceId === deviceId) {
          setIsPreviewActive(true);
          return;
        }
        if (!deviceId && !isMobile && currentTrackDeviceId) {
          // Default camera selected and stream already active on desktop
          setIsPreviewActive(true);
          return;
        }
      }

      // If switching to a different device, release previous track first so driver is not locked
      if (previewStreamRef.current && targetDeviceId !== undefined) {
        const currentTracks = previewStreamRef.current.getVideoTracks
          ? previewStreamRef.current.getVideoTracks()
          : previewStreamRef.current.getTracks?.() || [];
        const liveT = currentTracks.find((t) => t.readyState === 'live');
        const activeTrackId = liveT?.getSettings?.()?.deviceId;
        if (targetDeviceId && activeTrackId && activeTrackId !== targetDeviceId) {
          stopPreviewStream();
        }
      }

      const seq = ++acquisitionSeqRef.current;
      setCameraError(null);

      try {
        // Refresh devices list before acquiring (also populates the dropdown)
        const freshInputs = await CameraService.listVideoInputs();
        if (!isUnmountedRef.current && seq === acquisitionSeqRef.current) {
          setVideoDevices(freshInputs);
        }

        // Two authorities over one lens (our picker vs the browser's site-default
        // camera), so the intent passed here decides who wins:
        // - explicit dropdown pick  -> `{ deviceId: { exact } }`; a refusal
        //   (Chrome held a different device) widens back to the soft ladder
        //   and the read-back below reports what actually opened.
        // - no pick yet (initial open or fallback retry) on desktop ->
        //   `{ video: true }` first, honoring Chromium/Safari's persisted
        //   site-default pick; the read-back then pins that device into the
        //   dropdown, which only lists real cameras (no "Default Camera"
        //   option).
        // - mobile -> facingMode first (drivers that honor it).
        const { stream: newStream, deviceId: actualDeviceId } = await CameraService.acquireKioskStream(
          { deviceId, facingMode: facing },
          {
            timeoutMs: 15000,
            preferOsDefault: !isMobile && !deviceId,
            deviceIdExact: Boolean(deviceId),
            onFallback: (stage) => {
              log.warn('Camera attempt failed, falling back:', stage);
            },
          }
        );

        if (isUnmountedRef.current || seq !== acquisitionSeqRef.current) {
          newStream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // Ignore
            }
          });
          return;
        }

        // Seamless swap: Stop previous tracks ONLY after new stream is ready
        if (previewStreamRef.current && previewStreamRef.current !== newStream) {
          previewStreamRef.current.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // Ignore
            }
          });
        }

        previewStreamRef.current = newStream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = newStream;
          previewVideoRef.current.playsInline = true;
          previewVideoRef.current.muted = true;
          previewVideoRef.current.setAttribute('playsinline', 'true');
          previewVideoRef.current.setAttribute('muted', 'true');
          try {
            await previewVideoRef.current.play();
          } catch {
            // Autoplay ignore
          }
          setIsPreviewActive(true);
        }

        // Truth read-back: converge the picker on the device that is actually
        // streaming only if no explicit selection was made by the user.
        if (actualDeviceId && !deviceId) {
          setSelectedDeviceId(actualDeviceId);
        }

        // Auto-fallback if wired connection or external camera is unplugged while modal is open
        const liveTrack = newStream.getVideoTracks().find((t) => t.readyState === 'live');
        if (liveTrack) {
          liveTrack.onended = () => {
            if (isUnmountedRef.current) return;
            log.warn('Active camera track ended (e.g. wired connection disconnected). Falling back to OS default...');
            setSelectedDeviceId(undefined);
            void startPreview(undefined);
          };
        }

        await refreshDevices();
      } catch (err) {
        if (isUnmountedRef.current || seq !== acquisitionSeqRef.current) return;
        log.error('Camera preview error in setup modal:', err);
        setCameraError(CameraService.describeCameraFailure(err).message);
        setIsPreviewActive(false);
      }
    },
    [facingMode, selectedDeviceId, isMobile, refreshDevices]
  );

  // Auto-detect when wired cameras are plugged in or unplugged
  useEffect(() => {
    if (!open) return;
    const handleDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [open, refreshDevices]);

  // Manage camera lifecycle strictly when modal opens/closes
  useEffect(() => {
    isUnmountedRef.current = false;
    if (open) {
      setIsChangingPin(!hasPin);
      setLocalPin('');
      void startPreview(selectedDeviceId, facingMode);
    } else {
      stopPreviewStream();
    }

    return () => {
      isUnmountedRef.current = true;
      stopPreviewStream();
    };
  }, [open, hasPin, stopPreviewStream]);

  // Handle switching front/rear camera
  const handleToggleFacing = () => {
    playClickFeedback();
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setSelectedDeviceId(undefined); // Clear explicit ID when flipping modes
    void startPreview(undefined, nextMode);
  };

  // Handle device selector change
  const handleDeviceChange = (deviceId: string) => {
    playClickFeedback();
    const nextId = deviceId || undefined;
    setSelectedDeviceId(nextId);
    void startPreview(nextId, facingMode);
  };

  // PIN keypad handlers
  const handleDigit = useCallback(
    (digit: string) => {
      if (!isChangingPin && hasPin) {
        setIsChangingPin(true);
        setLocalPin(digit);
        playClickFeedback();
        return;
      }
      setLocalPin((prev) => {
        if (prev.length >= 4) return prev;
        playClickFeedback();
        return prev + digit;
      });
    },
    [isChangingPin, hasPin]
  );

  const handleBackspace = useCallback(() => {
    setLocalPin((prev) => {
      if (prev.length === 0) return prev;
      playClickFeedback();
      return prev.slice(0, -1);
    });
  }, []);

  // Launch kiosk with confirmed settings
  const handleLaunch = useCallback(() => {
    const finalPin = !isChangingPin && hasPin ? getPin() || pin : pin;
    if (!finalPin || finalPin.length !== 4) {
      playWarningBuzz();
      return;
    }
    if (cameraError) {
      playWarningBuzz();
      return;
    }

    playClickFeedback();
    setPin(finalPin);

    const config: KioskCameraConfig = {
      deviceId: selectedDeviceId,
      facingMode,
    };
    setCameraConfig(config);

    // Cleanly stop preview camera to release hardware back to the OS before kiosk launch
    stopPreviewStream();

    onLaunch({
      pin: finalPin,
      deviceId: selectedDeviceId,
      facingMode,
    });
  }, [
    isChangingPin,
    hasPin,
    getPin,
    pin,
    cameraError,
    setPin,
    selectedDeviceId,
    facingMode,
    setCameraConfig,
    stopPreviewStream,
    onLaunch,
  ]);

  const handleCancel = useCallback(() => {
    playClickFeedback();
    stopPreviewStream();
    onCancel();
  }, [stopPreviewStream, onCancel]);

  // Stable refs for keyboard listener to avoid listener churn
  const handleDigitRef = useRef(handleDigit);
  handleDigitRef.current = handleDigit;

  const handleBackspaceRef = useRef(handleBackspace);
  handleBackspaceRef.current = handleBackspace;

  const handleLaunchRef = useRef(handleLaunch);
  handleLaunchRef.current = handleLaunch;

  const handleCancelRef = useRef(handleCancel);
  handleCancelRef.current = handleCancel;

  // Physical keyboard listener for PIN entry, backspace, enter, and escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key >= '0' && e.key <= '9') {
        if (isEditingField) return;
        e.preventDefault();
        handleDigitRef.current(e.key);
      } else if (e.key === 'Backspace') {
        if (isEditingField) return;
        e.preventDefault();
        handleBackspaceRef.current();
      } else if (e.key === 'Enter') {
        if (isEditingField || target?.tagName === 'BUTTON') return;
        e.preventDefault();
        handleLaunchRef.current();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const isPinReady = (!isChangingPin && hasPin) || pin.length === 4;

  const deviceOptions = videoDevices.map((d, index) => ({
    value: d.deviceId,
    label: d.label || `Camera ${index + 1}`,
  }));

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Setup Kiosk Station"
      size="md"
      closeOnBackdrop={false}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outlined" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="filled"
            onClick={handleLaunch}
            disabled={!isPinReady || !!cameraError}
            className="flex items-center gap-2"
          >
            <ComputerDesktopIcon className="w-5 h-5" />
            <span>Launch Kiosk</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-1">
        {/* Intro */}
        <div className="flex items-start gap-3 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant">
          <div className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center shrink-0">
            <ComputerDesktopIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-on-surface">Station Onboarding</h4>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Verify your camera angle and configure your exit PIN before placing this device in
              attendee self-check-in mode. Camera selection is locked inside kiosk mode for security.
            </p>
          </div>
        </div>

        {/* 1. Camera Framing & Test Preview */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <VideoCameraIcon className="w-4 h-4 text-primary" />
              <span>Camera Setup & Framing</span>
            </label>
            {isPreviewActive ? (
              <Badge tone="success" className="text-[11px] py-0.5 px-2">
                Camera Ready
              </Badge>
            ) : cameraError ? (
              <Badge tone="danger" className="text-[11px] py-0.5 px-2">
                Access Error
              </Badge>
            ) : (
              <Badge tone="neutral" className="text-[11px] py-0.5 px-2">
                Initializing...
              </Badge>
            )}
          </div>

          {/* Live Preview Viewport */}
          <div className="relative aspect-[4/3] w-full max-w-sm mx-auto bg-surface-container-high rounded-2xl overflow-hidden border-2 border-outline-variant flex items-center justify-center shadow-inner">
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {!isPreviewActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-surface-container">
                {cameraError ? (
                  <>
                    <ExclamationTriangleIcon className="w-8 h-8 text-danger mb-2" />
                    <p className="text-xs text-danger font-medium">{cameraError}</p>
                    <Button variant="tonal" size="sm" className="mt-3" onClick={() => void startPreview()}>
                      Retry Camera
                    </Button>
                  </>
                ) : (
                  <>
                    <VideoCameraIcon className="w-8 h-8 text-on-surface-variant/40 animate-pulse mb-2" />
                    <p className="text-xs text-on-surface-variant">Connecting camera feed...</p>
                  </>
                )}
              </div>
            )}

            {/* Quick 1-tap flip button overlay on preview (Mobile/Tablet only) */}
            {isPreviewActive && isMobile && (
              <button
                type="button"
                onClick={handleToggleFacing}
                className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-surface/85 hover:bg-surface text-on-surface shadow-md backdrop-blur-md border border-outline-variant transition-transform active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center sm:hidden"
                title={facingMode === 'user' ? 'Switch to Rear Camera' : 'Switch to Front Camera'}
                aria-label="Flip Camera Orientation"
              >
                <ArrowPathIcon className="w-5 h-5 text-primary" />
              </button>
            )}
          </div>

          {/* Device Selection Dropdown (Especially for Desktop / USB Webcams).
              Real cameras only: after the acquisition read-back pins the
              negotiated device there is no ambiguity left to paper over with a
              "Default Camera" option. */}
          {videoDevices.length > 1 && (
            <div className="mt-1">
              <Select
                id="kiosk-camera-device"
                label="Active Camera Device"
                value={selectedDeviceId || ''}
                onChange={(e) => handleDeviceChange(e.target.value)}
                options={deviceOptions}
              />
            </div>
          )}
        </div>

        {/* 2. Security PIN Configuration */}
        <div className="flex flex-col gap-2.5 pt-1 border-t border-outline-variant">
          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <KeyIcon className="w-4 h-4 text-primary" />
            <span>Station Exit Security PIN</span>
          </label>

          {!isChangingPin && hasPin ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-success-container/40 border border-success/30">
              <div className="flex items-center gap-2.5">
                <CheckCircleIcon className="w-5 h-5 text-success" />
                <div>
                  <p className="text-xs font-semibold text-on-surface">PIN Configured</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Station is locked with session PIN (••••)
                  </p>
                </div>
              </div>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  playClickFeedback();
                  setIsChangingPin(true);
                  setLocalPin('');
                }}
              >
                Change PIN
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center bg-surface-container-low p-3.5 rounded-xl border border-outline-variant">
              <p className="text-xs text-on-surface-variant text-center mb-3">
                Enter a 4-digit PIN required to exit kiosk mode and return to the organizer dashboard.
              </p>

              {/* 4-digit Circles */}
              <div
                className="flex items-center justify-center gap-3.5 mb-3"
                aria-label={`${pin.length} of 4 digits entered`}
                role="status"
                aria-live="polite"
              >
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = index < pin.length;
                  return (
                    <div
                      key={index}
                      className={`w-3.5 h-3.5 rounded-full transition-[background-color,transform] duration-150 ${
                        isFilled ? 'bg-primary scale-110 shadow-xs' : 'bg-outline-variant/60'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Touch-Friendly Compact Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigit(digit)}
                    className="h-12 min-h-[48px] text-base font-semibold rounded-lg bg-surface text-on-surface hover:bg-secondary-container transition-colors shadow-xs active:scale-95 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Digit ${digit}`}
                  >
                    {digit}
                  </button>
                ))}
                <div />
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="h-12 min-h-[48px] text-base font-semibold rounded-lg bg-surface text-on-surface hover:bg-secondary-container transition-colors shadow-xs active:scale-95 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Digit 0"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-12 min-h-[48px] rounded-lg bg-surface text-on-surface hover:bg-secondary-container transition-colors shadow-xs active:scale-95 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Backspace"
                >
                  <BackspaceIcon className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              {/* Keyboard Tip */}
              <p className="text-[11px] text-on-surface-variant/70 mt-3 text-center">
                {pin.length === 4
                  ? 'PIN ready · Press Enter to launch kiosk'
                  : 'Type with physical keyboard (0-9) or tap keypad'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default KioskSetupModal;

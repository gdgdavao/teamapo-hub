import { ALLOWED_VERIFY_HOSTS } from '../../config/app';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { CameraService } from '../../services/cameraService';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  MagnifyingGlassIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  UserIcon,
  QrCodeIcon,
  CameraIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { CertificateService } from '../../services/certificateService';
import { Button, Card, Input } from '../../components/UI';
import { logger } from '../../utils/logger';

interface CertificateVerificationData {
  isValid: boolean;
  isRevoked?: boolean;
  recipientName?: string;
  eventTitle?: string;
  eventDate?: string;
  issuedDate?: string;
  verificationCode?: string;
  certificateUrl?: string;
  verificationCount?: number;
}

// Allowed domains for QR code verification
const ALLOWED_DOMAINS: readonly string[] = ALLOWED_VERIFY_HOSTS;

// Parse QR code data and validate domain
const parseQRCode = (qrData: string): { valid: boolean; code?: string; error?: string } => {
  try {
    // If it's just a code (not a URL), return it directly
    if (qrData.startsWith('CERT-')) {
      return { valid: true, code: qrData };
    }

    // Try to parse as URL
    const url = new URL(qrData);
    const hostname = url.hostname;

    // Validate domain
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowedDomain) {
      return { 
        valid: false, 
        error: `Invalid QR code source. This QR code is from "${hostname}" which is not an authorized domain.` 
      };
    }

    // Extract verification code from path
    const pathMatch = url.pathname.match(/\/verify\/([A-Z0-9-]+)/i);
    if (!pathMatch) {
      return { 
        valid: false, 
        error: 'Invalid QR code format. No verification code found in the URL.' 
      };
    }

    return { valid: true, code: pathMatch[1].toUpperCase() };
  } catch {
    // If not a valid URL, check if it looks like a verification code
    if (/^CERT-[A-Z0-9]+$/i.test(qrData)) {
      return { valid: true, code: qrData.toUpperCase() };
    }
    return { 
      valid: false, 
      error: 'Invalid QR code format. Please scan a valid certificate QR code.' 
    };
  }
};

const CertificateVerificationPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [verificationCode, setVerificationCode] = useState(code || '');
  const [verificationData, setVerificationData] = useState<CertificateVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Camera/Scanner state
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [hasCamera, setHasCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  
  // Image loading state
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for camera availability on mount
  useEffect(() => {
    const checkCamera = async () => {
      try {
        // Secure-origin gate first: a plain-http LAN exposes no
        // navigator.mediaDevices at all, so enumeration would throw.
        const support = CameraService.supportsKioskCamera();
        if (support) {
          setHasCamera(false);
          setAvailableCameras([]);
          return;
        }
        const videoDevices = await CameraService.listVideoInputs();
        setAvailableCameras(videoDevices);
        setHasCamera(videoDevices.length > 0);
      } catch (error) {
        logger.error('Error checking camera availability:', error);
        setHasCamera(false);
        setAvailableCameras([]);
      }
    };
    checkCamera();
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const verifyCertificate = useCallback(async (codeToVerify: string) => {
    const sanitized = codeToVerify.trim().replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
    if (!sanitized) {
      setErrorMessage('Please enter a valid verification code.');
      return;
    }

    setLoading(true);
    setSearchAttempted(true);
    setErrorMessage(null);
    setImageLoading(true);
    setImageError(false);

    try {
      const result = await CertificateService.verifyCertificate(sanitized);
      
      setVerificationData({
        isValid: result.isValid,
        isRevoked: result.isRevoked,
        recipientName: result.recipientName,
        eventTitle: result.eventTitle,
        eventDate: result.eventDate,
        issuedDate: result.issuedDate,
        verificationCode: sanitized,
        certificateUrl: result.certificateUrl,
        verificationCount: result.verificationCount
      });
    } catch (error) {
      logger.error('Error verifying certificate:', error);
      setErrorMessage('An error occurred while verifying the certificate. Please try again.');
      setVerificationData({
        isValid: false
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Shared scanner startup: acquire through the CameraService ladder and
  // register the ZXing decoder on the attached video element. The start and
  // flip paths previously each duplicated the acquisition, the QR callback,
  // and the error mapping — there is one copy now.
  const launchScanner = async (requestedFacing: 'environment' | 'user') => {
    setScanError(null);
    setIsCameraLoading(true);
    setIsCameraActive(true);

    try {
      // Engine ladder parity with the kiosk: OS-default camera first on
      // desktop, requested lens first on mobile (drivers that honor
      // facingMode); 15s wireless-camera ceiling with orphan rescue;
      // engine-specific remediation copy on failure.
      const { stream } = await CameraService.acquireKioskStream(
        { facingMode: requestedFacing },
        { preferOsDefault: !isMobile, onFallback: (stage) => logger.warn('Camera ladder fallback:', stage) }
      );

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      // WebKit de-pipelines a stream that moves between video elements:
      // load() restarts the decoder before play().
      try {
        videoRef.current.load();
      } catch {
        // Ignore
      }
      try {
        await videoRef.current.play();
      } catch {
        // Autoplay ignore
      }

      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserQRCodeReader();
      }
      setIsCameraLoading(false);
      setIsScanning(true);

      // Start continuous scanning from the video element; all camera hardware
      // stops as soon as a code lands (stopCamera clears the ZXing controls
      // and the acquired stream).
      scannerControlsRef.current = await codeReaderRef.current.decodeFromVideoElement(
        videoRef.current,
        (result, error) => {
          if (result) {
            const qrText = result.getText();
            logger.log('QR Code detected:', qrText);

            // Vibrate if supported (for mobile feedback)
            if ('vibrate' in navigator) {
              navigator.vibrate(200);
            }

            // Parse and validate the QR code
            const parsed = parseQRCode(qrText);

            if (parsed.valid && parsed.code) {
              stopCamera();
              setVerificationCode(parsed.code);
              verifyCertificate(parsed.code);
            } else {
              setScanError(parsed.error || 'Invalid QR code');
            }
          }

          if (error && (error as { name?: string }).name !== 'NotFoundException') {
            logger.warn('QR scanning error:', error);
          }
        }
      );
    } catch (error: unknown) {
      logger.error('Error accessing camera:', error);
      // Engine-specific copy (Safari address-bar camera lock, Firefox door
      // hanger, busy-camera app name) instead of name-string mapping.
      setScanError(CameraService.describeCameraFailure(error).message);
      setIsCameraActive(false);
      setIsScanning(false);
      setIsCameraLoading(false);
    }
  };

  const startCamera = () => launchScanner(facingMode);

  // Flip camera between front and back
  const handleFlipCamera = async () => {
    // Stop current camera first
    stopCamera();

    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);

    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Restart the acquisition with the new facing mode
    await launchScanner(newFacingMode);
  };

  const stopCamera = () => {
    if (scannerControlsRef.current) {
      scannerControlsRef.current.stop();
      scannerControlsRef.current = null;
    }
    
    // Stop all stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video srcObject
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraActive(false);
    setIsScanning(false);
    setIsCameraLoading(false);
    setScanError(null);
  };


  // Auto-verify if code is provided in URL
  useEffect(() => {
    if (code) {
      verifyCertificate(code);
    }
  }, [code, verifyCertificate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCertificate(verificationCode);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  return (
    <div className="min-h-page bg-surface-container-low py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-primary-container p-4">
              <AcademicCapIcon className="w-12 h-12 text-primary" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-on-surface mb-4">Certificate Verification</h1>
          <p className="text-xl text-on-surface-variant max-w-2xl mx-auto">
            Verify the authenticity of certificates issued by GDG Davao events.
            Enter the verification code or scan the QR code to check if a certificate is valid.
          </p>
        </div>

        {/* QR Scanner Section */}
        {isCameraActive && (
          <Card padding="lg" className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
                <CameraIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                {isCameraLoading ? 'Starting camera...' : 'Scanning QR Code...'}
              </h3>
              <div className="flex items-center gap-2">
                {/* Both were 36px icon buttons with no focus ring. The primitive
                    gives them the 48px floor and a visible focus ring. */}
                {availableCameras.length > 1 && !isCameraLoading && (
                  <Button
                    variant="text"
                    onClick={handleFlipCamera}
                    aria-label="Switch camera"
                    title={`Switch to ${facingMode === 'environment' ? 'front' : 'back'} camera`}
                    className="min-w-[48px] px-2xs text-on-surface-variant"
                    icon={<ArrowPathIcon />}
                  />
                )}
                <Button
                  variant="text"
                  onClick={stopCamera}
                  aria-label="Close camera"
                  className="min-w-[48px] px-2xs text-on-surface-variant"
                  icon={<XMarkIcon />}
                />
              </div>
            </div>

            <div className="relative aspect-video overflow-hidden rounded-lg bg-inverse-surface">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Loading overlay */}
              {isCameraLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-inverse-surface/80">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-10 w-10 rounded-full border-b-2 border-inverse-on-surface motion-essential animate-spin" />
                    <p className="text-sm text-inverse-on-surface">Starting camera...</p>
                  </div>
                </div>
              )}

              {/* Scanning overlay. The corner frame and the scan line both
                  centre with two -translate utilities instead of a `transform`
                  class carrying its own translate, which was ordering-dependent. */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-2 border-brand opacity-50" />
                <div className="absolute left-1/2 top-1/2 w-48 h-48 -translate-x-1/2 -translate-y-1/2 sm:w-64 sm:h-64">
                  <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-brand" />
                  <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-brand" />
                  <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-brand" />
                  <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-brand" />
                </div>
                {isScanning && !isCameraLoading && (
                  <div className="absolute left-1/2 top-1/2 h-0.5 w-48 -translate-x-1/2 -translate-y-1/2 bg-brand animate-pulse" />
                )}
              </div>
            </div>

            {scanError && (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-error-container bg-error-container p-3">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-on-error-container" aria-hidden="true" />
                <p className="text-sm text-on-error-container">{scanError}</p>
              </div>
            )}

            <p className="mt-4 text-center text-sm text-on-surface-variant">
              Position the QR code from the certificate within the frame
            </p>
          </Card>
        )}

        {/* Verification Form */}
        <Card padding="lg" className="mb-8">
          <form onSubmit={handleSubmit} className="space-y-md">
            <div className="relative">
              <Input
                mono
                label="Verification Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                placeholder="e.g., CERT-A1B2C3D4E5F6"
                hint="The verification code can be found on the certificate or in the QR code"
                className="pl-12"
              />
              <QrCodeIcon className="absolute left-4 top-[2.35rem] h-5 w-5 text-outline" aria-hidden="true" />
            </div>

            {errorMessage && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-error-container bg-error-container p-3">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-on-error-container" aria-hidden="true" />
                <p className="text-sm text-on-error-container">{errorMessage}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={loading}
                disabled={!verificationCode.trim()}
                icon={<MagnifyingGlassIcon />}
                className="sm:flex-1"
              >
                Verify Certificate
              </Button>

              {hasCamera && !isCameraActive && (
                <Button
                  variant="tonal"
                  size="lg"
                  fullWidth
                  onClick={startCamera}
                  disabled={loading}
                  icon={<CameraIcon />}
                  className="sm:flex-1"
                >
                  Scan QR Code
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Verification Results */}
        {searchAttempted && verificationData && (
          <Card padding="none" className="mb-8 overflow-hidden">
            {verificationData.isValid ? (
              // Valid Certificate
              <div className="p-8">
                <div className="mb-6 flex items-center justify-center">
                  <div className="rounded-full bg-success-container p-3">
                    <CheckCircleIcon className="h-8 w-8 text-success" aria-hidden="true" />
                  </div>
                </div>

                <div className="mb-8 text-center">
                  <h2 className="text-2xl font-bold text-success mb-2">Certificate Verified</h2>
                  <p className="text-on-surface-variant">This certificate is authentic and was issued by GDG Davao.</p>
                  {verificationData.verificationCount && verificationData.verificationCount > 0 && (
                    <p className="mt-2 flex items-center justify-center gap-1 text-sm text-on-surface-variant">
                      <ShieldCheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      This certificate has been verified {verificationData.verificationCount} time{verificationData.verificationCount > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Certificate Preview - Full Size */}
                {verificationData.certificateUrl && (
                  <div className="mb-8">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-2">
                      <h3 className="text-lg font-semibold text-on-surface">Certificate</h3>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!verificationData.certificateUrl) return;
                          try {
                            const response = await fetch(verificationData.certificateUrl);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `certificate-${verificationData.recipientName?.replace(/\s+/g, '_') || 'download'}-${verificationData.verificationCode}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            logger.error('Failed to download certificate:', err);
                          }
                        }}
                        icon={<ArrowDownTrayIcon />}
                      >
                        Download Certificate
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container">
                      {/* Skeleton loader */}
                      {imageLoading && (
                        <div className="w-full aspect-[1.414/1] animate-pulse bg-surface-dim flex items-center justify-center">
                          <div className="text-center">
                            <div className="mx-auto mb-2 h-8 w-8 rounded-full border-b-2 border-outline motion-essential animate-spin" />
                            <p className="text-sm text-on-surface-variant">Loading certificate...</p>
                          </div>
                        </div>
                      )}

                      {/* Image error state */}
                      {imageError && !imageLoading && (
                        <div className="w-full aspect-[1.414/1] bg-surface-container flex items-center justify-center">
                          <div className="text-center text-on-surface-variant">
                            <AcademicCapIcon className="mx-auto mb-2 h-12 w-12 opacity-50" aria-hidden="true" />
                            <p className="text-sm">Certificate preview unavailable</p>
                          </div>
                        </div>
                      )}

                      <img
                        src={verificationData.certificateUrl}
                        alt="Certificate"
                        className={`w-full h-auto ${imageLoading || imageError ? 'hidden' : 'block'}`}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                      />
                    </div>
                  </div>
                )}

                {/* Certificate Details */}
                <div className="space-y-md">
                  <h3 className="border-b border-outline-variant pb-2 text-lg font-semibold text-on-surface">Certificate Details</h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
                      <UserIcon className="mt-1 h-5 w-5 shrink-0 text-outline" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface-variant">Recipient</p>
                        <p className="min-w-0 break-words font-medium text-on-surface">{verificationData.recipientName}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
                      <AcademicCapIcon className="mt-1 h-5 w-5 shrink-0 text-outline" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface-variant">Event</p>
                        <p className="min-w-0 break-words font-medium text-on-surface">{verificationData.eventTitle}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
                      <CalendarDaysIcon className="mt-1 h-5 w-5 shrink-0 text-outline" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface-variant">Event Date</p>
                        <p className="min-w-0 break-words font-medium text-on-surface">
                          {verificationData.eventDate ? new Date(verificationData.eventDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
                      <CheckCircleIcon className="mt-1 h-5 w-5 shrink-0 text-outline" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface-variant">Issued Date</p>
                        <p className="min-w-0 break-words font-medium text-on-surface">
                          {verificationData.issuedDate ? new Date(verificationData.issuedDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3 sm:col-span-2">
                      <QrCodeIcon className="mt-1 h-5 w-5 shrink-0 text-outline" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface-variant">Verification Code</p>
                        <p className="min-w-0 break-all font-mono font-medium text-on-surface">{verificationData.verificationCode}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-lg border border-outline-variant bg-success-container p-4">
                  <p className="text-sm text-on-success-container">
                    <strong>Verification Successful:</strong> This certificate has been verified as authentic.
                    It was issued by GDG Davao and has not been tampered with.
                  </p>
                </div>
              </div>
            ) : verificationData.isRevoked ? (
              // Revoked Certificate
              <div className="p-8 text-center">
                <div className="mb-6 flex items-center justify-center">
                  <div className="rounded-full bg-warning-container p-3">
                    <ExclamationTriangleIcon className="h-8 w-8 text-warning" aria-hidden="true" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-warning mb-4">Certificate Revoked</h2>
                <p className="text-on-surface-variant mb-6">
                  This certificate has been revoked and is no longer valid.
                </p>

                {(verificationData.recipientName || verificationData.eventTitle) && (
                  <div className="mx-auto mb-6 max-w-md rounded-lg border border-outline-variant bg-warning-container p-4 text-left">
                    <p className="text-sm text-on-warning-container">
                      <strong>Original Details:</strong>
                    </p>
                    {verificationData.recipientName && (
                      <p className="mt-1 break-words text-sm text-on-warning-container">
                        Recipient: {verificationData.recipientName}
                      </p>
                    )}
                    {verificationData.eventTitle && (
                      <p className="break-words text-sm text-on-warning-container">
                        Event: {verificationData.eventTitle}
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-lg border border-outline-variant bg-warning-container p-4">
                  <p className="text-sm text-on-warning-container">
                    <strong>What does this mean?</strong> This certificate was previously issued but has been
                    revoked by the administrator. This could be due to duplicate issuance, data correction,
                    or other administrative reasons. Please contact GDG Davao if you believe this is an error.
                  </p>
                </div>
              </div>
            ) : (
              // Invalid Certificate - Not Found
              <div className="p-8 text-center">
                <div className="mb-6 flex items-center justify-center">
                  <div className="rounded-full bg-error-container p-3">
                    <XCircleIcon className="h-8 w-8 text-on-error-container" aria-hidden="true" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-error mb-4">Certificate Not Found</h2>
                <p className="text-on-surface-variant mb-6">
                  The verification code you entered could not be found in our database.
                  This could mean:
                </p>

                <ul className="mx-auto mb-6 max-w-md list-disc space-y-2 pl-5 text-left text-sm text-on-surface-variant">
                  <li>The verification code was entered incorrectly</li>
                  <li>The certificate is not authentic</li>
                  <li>The certificate was not issued by GDG Davao</li>
                </ul>

                <div className="rounded-lg border border-outline-variant bg-error-container p-4">
                  <p className="text-sm text-on-error-container">
                    <strong>Verification Failed:</strong> Please double-check the verification code and try again.
                    If you believe this is an error, please contact GDG Davao.
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Help Section */}
        <div className="mt-12 rounded-xl bg-primary-container p-8">
          <h2 className="text-lg font-semibold text-on-primary-container mb-4">Need Help?</h2>
          <div className="grid grid-cols-1 gap-6 text-sm text-on-primary-container md:grid-cols-2">
            <div className="min-w-0">
              <h3 className="font-medium mb-2">Where to find the verification code:</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>On the certificate itself (usually at the bottom)</li>
                <li>In the QR code on the certificate</li>
                <li>In the email with your certificate</li>
              </ul>
            </div>
            <div className="min-w-0">
              <h3 className="font-medium mb-2">Having issues?</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Make sure the code is entered correctly</li>
                <li>Check for extra spaces or characters</li>
                {hasCamera && <li>Try scanning the QR code instead</li>}
                <li>Contact us if the problem persists</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateVerificationPage; 
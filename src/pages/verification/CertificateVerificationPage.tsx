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
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  SparklesIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { CertificateService } from '../../services/certificateService';
import { Button, Card, Input, Badge, SegmentedControl, type SegmentedControlOption, toast } from '../../components/UI';
import { logger } from '../../utils/logger';
import usePageTitle from '../../hooks/usePageTitle';

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

type VerifyMode = 'code' | 'camera';

const VERIFY_MODE_OPTIONS: ReadonlyArray<SegmentedControlOption<VerifyMode>> = [
  { value: 'code', label: 'Enter Code' },
  { value: 'camera', label: 'Scan QR with Camera' },
];

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
  usePageTitle({
    title: 'Certificate Verification',
    contextTitle: verificationData?.isValid ? verificationData.recipientName : code || undefined,
  });
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verification mode & clipboard states
  const [verifyMode, setVerifyMode] = useState<VerifyMode>('code');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
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
  // register the ZXing decoder on the attached video element.
  const launchScanner = async (requestedFacing: 'environment' | 'user') => {
    setScanError(null);
    setIsCameraLoading(true);
    setIsCameraActive(true);

    try {
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

      scannerControlsRef.current = await codeReaderRef.current.decodeFromVideoElement(
        videoRef.current,
        (result, error) => {
          if (result) {
            const qrText = result.getText();
            logger.log('QR Code detected:', qrText);

            if ('vibrate' in navigator) {
              navigator.vibrate(200);
            }

            const parsed = parseQRCode(qrText);

            if (parsed.valid && parsed.code) {
              stopCamera();
              setVerifyMode('code');
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
      setScanError(CameraService.describeCameraFailure(error).message);
      setIsCameraActive(false);
      setIsScanning(false);
      setIsCameraLoading(false);
      setVerifyMode('code');
    }
  };

  const startCamera = () => launchScanner(facingMode);

  // Flip camera between front and back
  const handleFlipCamera = async () => {
    stopCamera();
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);
    await new Promise(resolve => setTimeout(resolve, 100));
    await launchScanner(newFacingMode);
  };

  const stopCamera = () => {
    if (scannerControlsRef.current) {
      scannerControlsRef.current.stop();
      scannerControlsRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraActive(false);
    setIsScanning(false);
    setIsCameraLoading(false);
    setScanError(null);
  };

  const handleModeChange = (mode: VerifyMode) => {
    setVerifyMode(mode);
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
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

  const handleDownloadCertificate = async () => {
    if (!verificationData?.certificateUrl) return;
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
      toast.success('Certificate downloaded successfully!');
    } catch (err) {
      logger.error('Failed to download certificate:', err);
      toast.error('Failed to download certificate');
    }
  };

  const copyVerificationCode = async (codeToCopy: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(codeToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = codeToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success('Verification code copied to clipboard!');
    } catch {
      toast.error('Failed to copy verification code');
    }
  };

  const copyVerificationLink = async () => {
    if (!verificationData?.verificationCode) return;
    const link = `${window.location.origin}/verify/${verificationData.verificationCode}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success('Verification link copied to clipboard!');
    } catch {
      toast.error('Failed to copy verification link');
    }
  };

  const getLinkedInCertificationUrl = () => {
    if (!verificationData || !verificationData.verificationCode) return '';
    const baseUrl = 'https://www.linkedin.com/profile/add';
    const params = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: `Certificate of Participation - ${verificationData.eventTitle || 'GDG Davao'}`,
      organizationName: 'Google Developer Groups Davao',
      issueYear: String(new Date().getFullYear()),
      issueMonth: String(new Date().getMonth() + 1),
      certUrl: `${window.location.origin}/verify/${verificationData.verificationCode}`,
      certId: verificationData.verificationCode,
    });
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className="min-h-page bg-surface-container-low py-12 relative">
      {/* Google 4-Color Signature Accent Strip */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10" aria-hidden="true">
        <div className="h-full w-1/4 bg-[#4285F4]" />
        <div className="h-full w-1/4 bg-[#EA4335]" />
        <div className="h-full w-1/4 bg-[#FBBC04]" />
        <div className="h-full w-1/4 bg-[#34A853]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Badge tone="info" className="gap-1.5">
              <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Official Credential Registry
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-on-surface mb-3 tracking-tight">
            Certificate Verification
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto">
            Verify the authenticity of digital certificates issued by Google Developer Groups Davao. Check verification codes or scan credentials instantly.
          </p>
        </div>

        {/* Verification Method Toggle */}
        {hasCamera && (
          <div className="mb-6 flex justify-center">
            <SegmentedControl<VerifyMode>
              options={VERIFY_MODE_OPTIONS}
              value={verifyMode}
              onChange={handleModeChange}
              label="Verification method"
              className="w-full sm:w-auto min-w-[280px]"
            />
          </div>
        )}

        {/* QR Scanner View */}
        {verifyMode === 'camera' && isCameraActive && (
          <Card padding="lg" className="mb-8 shadow-elevation-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-on-surface">
                <CameraIcon className="w-5 h-5 shrink-0 text-primary" aria-hidden="true" />
                {isCameraLoading ? 'Starting camera...' : 'Scanning QR Code...'}
              </h3>
              <div className="flex items-center gap-2">
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
                  onClick={() => handleModeChange('code')}
                  aria-label="Close camera"
                  className="min-w-[48px] px-2xs text-on-surface-variant"
                  icon={<XMarkIcon />}
                />
              </div>
            </div>

            <div className="relative aspect-video overflow-hidden rounded-xl bg-inverse-surface shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {isCameraLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-inverse-surface/80">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-10 w-10 rounded-full border-b-2 border-inverse-on-surface motion-essential animate-spin" />
                    <p className="text-sm text-inverse-on-surface">Initializing camera stream...</p>
                  </div>
                </div>
              )}

              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-2 border-brand/40" />
                <div className="absolute left-1/2 top-1/2 w-48 h-48 -translate-x-1/2 -translate-y-1/2 sm:w-64 sm:h-64">
                  <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-brand" />
                  <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-brand" />
                  <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-brand" />
                  <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-brand" />
                  {isScanning && !isCameraLoading && (
                    <div className="absolute inset-x-0 h-0.5 bg-brand animate-scanline shadow-sm shadow-brand" />
                  )}
                </div>
              </div>
            </div>

            {scanError && (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-error-container bg-error-container p-3 text-left">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-on-error-container" aria-hidden="true" />
                <p className="text-sm text-on-error-container">{scanError}</p>
              </div>
            )}

            <p className="mt-4 text-center text-sm text-on-surface-variant">
              Align the certificate QR code inside the viewfinder box
            </p>
          </Card>
        )}

        {/* Manual Code Input Form */}
        {verifyMode === 'code' && (
          <Card padding="lg" className="mb-8 shadow-elevation-1">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  mono
                  label="Verification Code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  placeholder="e.g., CERT-A1B2C3D4E5F6"
                  hint="The verification code can be found at the bottom of the certificate or in your confirmation email"
                  className="pl-12"
                />
                <QrCodeIcon className="absolute left-4 top-[2.35rem] h-5 w-5 text-outline pointer-events-none" aria-hidden="true" />
              </div>

              {errorMessage && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-error-container bg-error-container p-3">
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
                    onClick={() => handleModeChange('camera')}
                    disabled={loading}
                    icon={<CameraIcon />}
                    className="sm:flex-1"
                  >
                    Scan with Camera
                  </Button>
                )}
              </div>
            </form>
          </Card>
        )}

        {/* Verification Results */}
        {searchAttempted && verificationData && (
          <Card padding="none" className="mb-8 overflow-hidden shadow-elevation-2 animate-success-pop motion-reduce:animate-none">
            {verificationData.isValid ? (
              // Valid Certificate
              <div className="p-6 sm:p-8">
                {/* Verified Header & Security Seal */}
                <div className="mb-8 flex flex-col items-center justify-center text-center">
                  <div className="relative mb-3 flex items-center justify-center">
                    <div className="rounded-full bg-success-container p-4 animate-seal-ripple motion-reduce:animate-none">
                      <ShieldCheckIcon className="h-10 w-10 text-success" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                    <Badge tone="success" pulse>
                      Verified Authentic
                    </Badge>
                    {verificationData.verificationCount && verificationData.verificationCount > 0 && (
                      <Badge tone="neutral">
                        Verified {verificationData.verificationCount} time{verificationData.verificationCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                    Certificate of Participation
                  </h2>
                  <p className="mt-1 text-sm sm:text-base text-on-surface-variant max-w-md mx-auto">
                    Officially conferred to <span className="font-semibold text-on-surface">{verificationData.recipientName}</span>
                  </p>
                </div>

                {/* Certificate Preview Card */}
                {verificationData.certificateUrl && (
                  <div className="mb-8">
                    <div className="group relative overflow-hidden rounded-xl border border-outline-variant bg-surface certificate-card-tilt shadow-elevation-1">
                      <div
                        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-card-shine motion-reduce:hidden"
                        aria-hidden="true"
                      />
                      {imageLoading && (
                        <div className="w-full aspect-[11/8.5] bg-surface-container animate-pulse flex items-center justify-center">
                          <div className="text-center">
                            <div className="mx-auto mb-2 h-8 w-8 rounded-full border-b-2 border-primary motion-essential animate-spin" />
                            <p className="text-xs text-on-surface-variant">Loading certificate preview...</p>
                          </div>
                        </div>
                      )}
                      {imageError && !imageLoading && (
                        <div className="w-full aspect-[11/8.5] bg-surface-container flex items-center justify-center">
                          <div className="text-center text-on-surface-variant p-4">
                            <AcademicCapIcon className="mx-auto mb-2 h-10 w-10 opacity-50" aria-hidden="true" />
                            <p className="text-sm">Certificate preview unavailable</p>
                          </div>
                        </div>
                      )}
                      <img
                        src={verificationData.certificateUrl}
                        alt={`Certificate for ${verificationData.recipientName || 'Participant'}`}
                        className={`w-full h-auto object-contain ${imageLoading || imageError ? 'hidden' : 'block'}`}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                      />
                    </div>
                  </div>
                )}

                {/* Certificate Details Grid */}
                <div className="space-y-4">
                  <h3 className="border-b border-outline-variant pb-2 text-base font-semibold text-on-surface">
                    Credential Details
                  </h3>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3.5">
                      <UserIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Recipient</p>
                        <p className="min-w-0 break-words font-medium text-on-surface text-base">{verificationData.recipientName}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3.5">
                      <AcademicCapIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Event</p>
                        <p className="min-w-0 break-words font-medium text-on-surface text-base">{verificationData.eventTitle}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3.5">
                      <CalendarDaysIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Event Date</p>
                        <p className="min-w-0 break-words font-medium text-on-surface text-base">
                          {verificationData.eventDate ? new Date(verificationData.eventDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3.5">
                      <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Issued Date</p>
                        <p className="min-w-0 break-words font-medium text-on-surface text-base">
                          {verificationData.issuedDate ? new Date(verificationData.issuedDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3.5 sm:col-span-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <QrCodeIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Verification Code</p>
                          <code className="min-w-0 break-all font-mono font-semibold text-primary select-all text-sm sm:text-base">
                            {verificationData.verificationCode}
                          </code>
                        </div>
                      </div>
                      <Button
                        variant={copiedCode ? 'tonal' : 'text'}
                        size="sm"
                        onClick={() => copyVerificationCode(verificationData.verificationCode || '')}
                        title="Copy code"
                        aria-label="Copy verification code"
                        icon={copiedCode ? <CheckIcon className="text-success" /> : <ClipboardDocumentIcon />}
                        className="min-h-control shrink-0 px-3"
                      >
                        {copiedCode ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Quick Action Cluster */}
                <div className="mt-8 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button
                      size="lg"
                      fullWidth
                      onClick={handleDownloadCertificate}
                      icon={<ArrowDownTrayIcon />}
                    >
                      Download PNG
                    </Button>

                    <Button
                      variant="tonal"
                      size="lg"
                      fullWidth
                      onClick={copyVerificationLink}
                      icon={copiedLink ? <CheckIcon className="text-success" /> : <LinkIcon />}
                    >
                      {copiedLink ? 'Link Copied!' : 'Share Link'}
                    </Button>

                    <a
                      href={getLinkedInCertificationUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-control items-center justify-center gap-2 rounded border border-outline px-control-x font-medium text-on-surface hover:bg-surface-container transition-colors duration-short2 text-sm sm:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
                      <span>Add to LinkedIn</span>
                    </a>
                  </div>

                  {/* Trust Statement */}
                  <div className="rounded-xl border border-outline-variant bg-success-container/30 p-4 text-left">
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="h-5 w-5 shrink-0 text-success mt-0.5" aria-hidden="true" />
                      <div className="text-sm">
                        <p className="font-semibold text-on-surface">Tamper-Evident Verification</p>
                        <p className="text-on-surface-variant mt-0.5">
                          This certificate is verified authentic. It is registered in the TeamApo Hub repository for GDG Davao events and has not been altered or compromised.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : verificationData.isRevoked ? (
              // Revoked Certificate
              <div className="p-8 text-center">
                <div className="mb-4 flex items-center justify-center">
                  <div className="rounded-full bg-warning-container p-3">
                    <ExclamationTriangleIcon className="h-8 w-8 text-warning" aria-hidden="true" />
                  </div>
                </div>

                <div className="flex justify-center mb-2">
                  <Badge tone="warning">Status: Revoked</Badge>
                </div>

                <h2 className="text-2xl font-bold text-warning mb-2">Certificate Revoked</h2>
                <p className="text-on-surface-variant mb-6 max-w-md mx-auto">
                  This certificate was previously issued but has been revoked by the event administrator.
                </p>

                {(verificationData.recipientName || verificationData.eventTitle) && (
                  <div className="mx-auto mb-6 max-w-md rounded-xl border border-outline-variant bg-warning-container/40 p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wider text-on-warning-container">Original Details</p>
                    {verificationData.recipientName && (
                      <p className="mt-1 text-sm font-medium text-on-warning-container">
                        Recipient: {verificationData.recipientName}
                      </p>
                    )}
                    {verificationData.eventTitle && (
                      <p className="text-sm text-on-warning-container">
                        Event: {verificationData.eventTitle}
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-on-surface-variant">
                  If you believe this revocation was made in error, please contact{' '}
                  <a href="mailto:support@gdgdavao.org" className="text-primary underline">support@gdgdavao.org</a>.
                </p>
              </div>
            ) : (
              // Invalid Certificate - Not Found
              <div className="p-8 text-center">
                <div className="mb-4 flex items-center justify-center">
                  <div className="rounded-full bg-error-container p-3">
                    <XCircleIcon className="h-8 w-8 text-on-error-container" aria-hidden="true" />
                  </div>
                </div>

                <div className="flex justify-center mb-2">
                  <Badge tone="danger">Verification Failed</Badge>
                </div>

                <h2 className="text-2xl font-bold text-error mb-2">Certificate Not Found</h2>
                <p className="text-on-surface-variant mb-6 max-w-md mx-auto">
                  We could not find a certificate matching code <code className="font-mono font-semibold">{verificationCode}</code> in the GDG Davao registry.
                </p>

                <div className="mx-auto mb-6 max-w-md rounded-xl border border-outline-variant bg-surface-container p-4 text-left text-sm text-on-surface-variant">
                  <p className="font-semibold text-on-surface mb-2">Troubleshooting suggestions:</p>
                  <ul className="list-disc space-y-1.5 pl-5">
                    <li>Double-check for typos or missed characters in the verification code.</li>
                    <li>Ensure the prefix <code className="font-mono">CERT-</code> was included.</li>
                    <li>Scan the certificate directly using the camera option above.</li>
                  </ul>
                </div>

                <Button
                  variant="outlined"
                  onClick={() => {
                    setVerificationCode('');
                    setSearchAttempted(false);
                    setVerificationData(null);
                  }}
                  icon={<ArrowPathIcon />}
                >
                  Try Another Code
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Help & Support Section */}
        <Card padding="lg" className="shadow-elevation-0 border border-outline-variant">
          <div className="flex items-center gap-2 mb-4">
            <InformationCircleIcon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
            <h2 className="text-base font-semibold text-on-surface">Need Help Verifying?</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 text-sm text-on-surface-variant md:grid-cols-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-on-surface mb-2">Where to find your code:</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Printed at the bottom-center of your certificate PNG or PDF.</li>
                <li>Encoded inside the QR code in the bottom corner of your certificate.</li>
                <li>In your confirmation or certificate claim email from GDG Davao.</li>
              </ul>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-on-surface mb-2">Community Support:</h3>
              <p className="mb-2">
                Have questions about your attendance status or missing certificates?
              </p>
              <p>
                Reach out to the volunteer organizing team at{' '}
                <a
                  href="mailto:support@gdgdavao.org"
                  className="font-medium text-primary underline hover:text-primary-hover"
                >
                  support@gdgdavao.org
                </a>
              </p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-xs text-on-surface-variant">
            Powered by TeamApo Hub • Google Developer Groups Davao
          </p>
        </div>
      </div>
    </div>
  );
};

export default CertificateVerificationPage; 
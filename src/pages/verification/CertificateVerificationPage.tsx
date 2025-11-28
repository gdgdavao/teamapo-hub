import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
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
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { CertificateService } from '../../services/certificateService';
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
const ALLOWED_DOMAINS = [
  'apohub.gdgdavao.org',
  'apohub-gdgdavao.vercel.app',
  'localhost',
  '127.0.0.1'
];

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
  const [hasCamera, setHasCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  // Image loading state
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);

  // Check for camera availability on mount
  useEffect(() => {
    const checkCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          setHasCamera(false);
          return;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasCamera(videoDevices.length > 0);
      } catch (error) {
        logger.error('Error checking camera availability:', error);
        setHasCamera(false);
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
    if (!codeToVerify.trim()) {
      setErrorMessage('Please enter a verification code');
      return;
    }

    setLoading(true);
    setSearchAttempted(true);
    setErrorMessage(null);
    setImageLoading(true);
    setImageError(false);

    try {
      const result = await CertificateService.verifyCertificate(codeToVerify.trim());
      
      setVerificationData({
        isValid: result.isValid,
        isRevoked: result.isRevoked,
        recipientName: result.recipientName,
        eventTitle: result.eventTitle,
        eventDate: result.eventDate,
        issuedDate: result.issuedDate,
        verificationCode: codeToVerify.trim().toUpperCase(),
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

  // Start camera for QR scanning
  const startCamera = async () => {
    try {
      setScanError(null);
      
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserQRCodeReader();
      }

      setIsCameraActive(true);
      setIsScanning(true);

      // Start continuous scanning
      scannerControlsRef.current = await codeReaderRef.current.decodeFromVideoDevice(
        undefined, // Use default camera (environment/back camera preferred)
        videoRef.current!,
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
              // Stop scanning
              stopCamera();
              // Set the verification code and trigger verification
              setVerificationCode(parsed.code);
              verifyCertificate(parsed.code);
            } else {
              setScanError(parsed.error || 'Invalid QR code');
            }
          }
          
          if (error && error.name !== 'NotFoundException') {
            logger.warn('QR scanning error:', error);
          }
        }
      );
    } catch (error) {
      logger.error('Error accessing camera:', error);
      setScanError('Unable to access camera. Please check permissions and try again.');
      setIsCameraActive(false);
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (scannerControlsRef.current) {
      scannerControlsRef.current.stop();
      scannerControlsRef.current = null;
    }
    setIsCameraActive(false);
    setIsScanning(false);
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
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-100 rounded-full">
              <AcademicCapIcon className="w-12 h-12 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Certificate Verification</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Verify the authenticity of certificates issued by GDG Davao events. 
            Enter the verification code or scan the QR code to check if a certificate is valid.
          </p>
        </div>

        {/* QR Scanner Section */}
        {isCameraActive && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CameraIcon className="w-5 h-5" />
                Scanning QR Code...
              </h3>
              <button
                type="button"
                onClick={stopCamera}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close camera"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-2 border-blue-500 opacity-50" />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500" />
                </div>
                {isScanning && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-0.5 sm:w-64 bg-blue-500 animate-pulse" />
                )}
              </div>
            </div>

            {scanError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{scanError}</p>
              </div>
            )}

            <p className="mt-4 text-sm text-gray-500 text-center">
              Position the QR code from the certificate within the frame
            </p>
          </div>
        )}

        {/* Verification Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="verification-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  placeholder="e.g., CERT-A1B2C3D4E5F6"
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                  aria-label="Certificate verification code"
                  tabIndex={0}
                />
                <QrCodeIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                The verification code can be found on the certificate or in the QR code
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading || !verificationCode.trim()}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
                tabIndex={0}
                aria-label="Verify certificate"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="w-5 h-5 mr-3" />
                    Verify Certificate
                  </>
                )}
              </button>

              {hasCamera && !isCameraActive && (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={loading}
                  className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  tabIndex={0}
                  aria-label="Scan QR code with camera"
                >
                  <CameraIcon className="w-5 h-5 mr-2" />
                  Scan QR Code
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Verification Results */}
        {searchAttempted && verificationData && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {verificationData.isValid ? (
              // Valid Certificate
              <div className="p-8">
                <div className="flex items-center justify-center mb-6">
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircleIcon className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-green-600 mb-2">Certificate Verified ✓</h2>
                  <p className="text-gray-600">This certificate is authentic and was issued by GDG Davao.</p>
                  {verificationData.verificationCount && verificationData.verificationCount > 0 && (
                    <p className="mt-2 text-sm text-gray-500 flex items-center justify-center gap-1">
                      <ShieldCheckIcon className="w-4 h-4" />
                      This certificate has been verified {verificationData.verificationCount} time{verificationData.verificationCount > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Certificate Preview - Full Size */}
                {verificationData.certificateUrl && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Certificate</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                      {/* Skeleton loader */}
                      {imageLoading && (
                        <div className="w-full aspect-[1.414/1] animate-pulse bg-gray-200 flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Loading certificate...</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Image error state */}
                      {imageError && !imageLoading && (
                        <div className="w-full aspect-[1.414/1] bg-gray-100 flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <AcademicCapIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
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
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Certificate Details</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <UserIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">Recipient</p>
                        <p className="font-medium text-gray-900">{verificationData.recipientName}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <AcademicCapIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">Event</p>
                        <p className="font-medium text-gray-900">{verificationData.eventTitle}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <CalendarDaysIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">Event Date</p>
                        <p className="font-medium text-gray-900">
                          {verificationData.eventDate ? new Date(verificationData.eventDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <CheckCircleIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">Issued Date</p>
                        <p className="font-medium text-gray-900">
                          {verificationData.issuedDate ? new Date(verificationData.issuedDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg sm:col-span-2">
                      <QrCodeIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">Verification Code</p>
                        <p className="font-medium text-gray-900 font-mono">{verificationData.verificationCode}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Verification Successful:</strong> This certificate has been verified as authentic. 
                    It was issued by GDG Davao and has not been tampered with.
                  </p>
                </div>
              </div>
            ) : verificationData.isRevoked ? (
              // Revoked Certificate
              <div className="p-8 text-center">
                <div className="flex items-center justify-center mb-6">
                  <div className="p-3 bg-amber-100 rounded-full">
                    <ExclamationTriangleIcon className="w-8 h-8 text-amber-600" />
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold text-amber-600 mb-4">Certificate Revoked</h2>
                <p className="text-gray-600 mb-6">
                  This certificate has been revoked and is no longer valid.
                </p>
                
                {(verificationData.recipientName || verificationData.eventTitle) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                    <p className="text-sm text-amber-800">
                      <strong>Original Details:</strong>
                    </p>
                    {verificationData.recipientName && (
                      <p className="text-sm text-amber-700 mt-1">
                        Recipient: {verificationData.recipientName}
                      </p>
                    )}
                    {verificationData.eventTitle && (
                      <p className="text-sm text-amber-700">
                        Event: {verificationData.eventTitle}
                      </p>
                    )}
                  </div>
                )}

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>What does this mean?</strong> This certificate was previously issued but has been 
                    revoked by the administrator. This could be due to duplicate issuance, data correction, 
                    or other administrative reasons. Please contact GDG Davao if you believe this is an error.
                  </p>
                </div>
              </div>
            ) : (
              // Invalid Certificate - Not Found
              <div className="p-8 text-center">
                <div className="flex items-center justify-center mb-6">
                  <div className="p-3 bg-red-100 rounded-full">
                    <XCircleIcon className="w-8 h-8 text-red-600" />
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold text-red-600 mb-4">Certificate Not Found</h2>
                <p className="text-gray-600 mb-6">
                  The verification code you entered could not be found in our database. 
                  This could mean:
                </p>
                
                <div className="text-left max-w-md mx-auto space-y-2 mb-6">
                  <p className="text-sm text-gray-600">• The verification code was entered incorrectly</p>
                  <p className="text-sm text-gray-600">• The certificate is not authentic</p>
                  <p className="text-sm text-gray-600">• The certificate was not issued by GDG Davao</p>
                </div>

                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Verification Failed:</strong> Please double-check the verification code and try again.
                    If you believe this is an error, please contact GDG Davao.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-blue-50 rounded-xl p-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">Need Help?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
            <div>
              <h3 className="font-medium mb-2">Where to find the verification code:</h3>
              <ul className="space-y-1">
                <li>• On the certificate itself (usually at the bottom)</li>
                <li>• In the QR code on the certificate</li>
                <li>• In the email with your certificate</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Having issues?</h3>
              <ul className="space-y-1">
                <li>• Make sure the code is entered correctly</li>
                <li>• Check for extra spaces or characters</li>
                {hasCamera && <li>• Try scanning the QR code instead</li>}
                <li>• Contact us if the problem persists</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateVerificationPage; 
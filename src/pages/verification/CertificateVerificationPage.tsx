import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  MagnifyingGlassIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  UserIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';

interface CertificateVerificationData {
  isValid: boolean;
  recipientName?: string;
  eventTitle?: string;
  eventDate?: string;
  issuedDate?: string;
  verificationCode?: string;
  certificateUrl?: string;
}

const CertificateVerificationPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [verificationCode, setVerificationCode] = useState(code || '');
  const [verificationData, setVerificationData] = useState<CertificateVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const verifyCertificate = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) {
      alert('Please enter a verification code');
      return;
    }

    setLoading(true);
    setSearchAttempted(true);

    try {
      // Simulate API call - in real implementation, this would call your backend
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock verification data
      const mockCertificates = [
        {
          code: 'CERT-2025-001',
          isValid: true,
          recipientName: 'John Doe',
          eventTitle: 'Web Development Workshop',
          eventDate: '2025-01-15',
          issuedDate: '2025-01-15T16:00:00Z',
          certificateUrl: '/images/cert-sample.png'
        },
        {
          code: 'CERT-2025-002',
          isValid: true,
          recipientName: 'Jane Smith',
          eventTitle: 'AI/ML Fundamentals',
          eventDate: '2025-01-20',
          issuedDate: '2025-01-20T17:30:00Z',
          certificateUrl: '/images/cert-sample-2.png'
        }
      ];

      const found = mockCertificates.find(cert => 
        cert.code.toLowerCase() === codeToVerify.toLowerCase()
      );

      if (found) {
        setVerificationData({
          isValid: true,
          recipientName: found.recipientName,
          eventTitle: found.eventTitle,
          eventDate: found.eventDate,
          issuedDate: found.issuedDate,
          verificationCode: found.code,
          certificateUrl: found.certificateUrl
        });
      } else {
        setVerificationData({
          isValid: false
        });
      }
    } catch (error) {
      console.error('Error verifying certificate:', error);
      setVerificationData({
        isValid: false
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify if code is provided in URL
  useEffect(() => {
    if (code) {
      verifyCertificate(code);
    }
  }, [code]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCertificate(verificationCode);
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
            Enter the verification code to check if a certificate is valid.
          </p>
        </div>

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
                  placeholder="e.g., CERT-2025-001"
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                />
                <QrCodeIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                The verification code can be found on the certificate or in the QR code
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !verificationCode.trim()}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Verifying...
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="w-5 h-5 mr-3" />
                  Verify Certificate
                </>
              )}
            </button>
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Certificate Details */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Certificate Details</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <UserIcon className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Recipient</p>
                          <p className="font-medium text-gray-900">{verificationData.recipientName}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <AcademicCapIcon className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Event</p>
                          <p className="font-medium text-gray-900">{verificationData.eventTitle}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <CalendarDaysIcon className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Event Date</p>
                          <p className="font-medium text-gray-900">
                            {verificationData.eventDate ? new Date(verificationData.eventDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <QrCodeIcon className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Verification Code</p>
                          <p className="font-medium text-gray-900 font-mono">{verificationData.verificationCode}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <CheckCircleIcon className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Issued Date</p>
                          <p className="font-medium text-gray-900">
                            {verificationData.issuedDate ? new Date(verificationData.issuedDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Certificate Preview */}
                  {verificationData.certificateUrl && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Certificate Preview</h3>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={verificationData.certificateUrl}
                          alt="Certificate"
                          className="w-full h-auto"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xODAgMTUwTDIwNCAxMzRMMjI4IDE1MEwyMDQgMTY2TDE4MCAxNTBaIiBmaWxsPSIjOUI5QkEwIi8+Cjwvc3ZnPgo=';
                          }}
                        />
                        <div className="p-4 bg-gray-50 text-center">
                          <p className="text-sm text-gray-600">Certificate preview - Not for official use</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Verification Successful:</strong> This certificate has been verified as authentic. 
                    It was issued by GDG Davao and has not been tampered with.
                  </p>
                </div>
              </div>
            ) : (
              // Invalid Certificate
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
                  <p className="text-sm text-gray-600">• The certificate has been revoked</p>
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
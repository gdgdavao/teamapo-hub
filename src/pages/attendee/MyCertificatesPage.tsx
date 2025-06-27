import React, { useState, useEffect } from 'react';
import { 
  AcademicCapIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';

interface Certificate {
  id: string;
  eventTitle: string;
  eventDate: string;
  issuedDate: string;
  verificationCode: string;
  certificateUrl: string;
  status: 'issued' | 'verified';
  downloadCount: number;
}

const MyCertificatesPage: React.FC = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Mock data - in real implementation, this would fetch from API
    setTimeout(() => {
      setCertificates([
        {
          id: '1',
          eventTitle: 'Web Development Workshop',
          eventDate: '2025-01-15',
          issuedDate: '2025-01-15T16:00:00Z',
          verificationCode: 'CERT-2025-001',
          certificateUrl: '/images/cert-sample.png',
          status: 'verified',
          downloadCount: 3
        },
        {
          id: '2',
          eventTitle: 'AI/ML Fundamentals',
          eventDate: '2025-01-20',
          issuedDate: '2025-01-20T17:30:00Z',
          verificationCode: 'CERT-2025-002',
          certificateUrl: '/images/cert-sample-2.png',
          status: 'issued',
          downloadCount: 1
        },
        {
          id: '3',
          eventTitle: 'Mobile App Development with Flutter',
          eventDate: '2025-01-25',
          issuedDate: '2025-01-25T15:45:00Z',
          verificationCode: 'CERT-2025-003',
          certificateUrl: '/images/cert-sample-3.png',
          status: 'verified',
          downloadCount: 2
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const downloadCertificate = (certificate: Certificate) => {
    // Create a temporary link to download the certificate
    const link = document.createElement('a');
    link.href = certificate.certificateUrl;
    link.download = `${certificate.eventTitle.replace(/\s+/g, '_')}_Certificate.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Update download count (in real app, this would be an API call)
    setCertificates(prev => 
      prev.map(cert => 
        cert.id === certificate.id 
          ? { ...cert, downloadCount: cert.downloadCount + 1 }
          : cert
      )
    );
  };

  const viewCertificate = (certificate: Certificate) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head><title>${certificate.eventTitle} - Certificate</title></head>
          <body style="margin: 0; padding: 20px; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <img src="${certificate.certificateUrl}" alt="Certificate" style="max-width: 100%; height: auto; border-radius: 4px;" />
              <div style="margin-top: 16px; text-center;">
                <button onclick="window.print()" style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Print</button>
                <button onclick="window.close()" style="background: #6b7280; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Close</button>
              </div>
              <p style="text-align: center; margin-top: 8px; color: #6b7280; font-size: 14px;">
                Verification Code: <strong>${certificate.verificationCode}</strong>
              </p>
            </div>
          </body>
        </html>
      `);
    }
  };

  const verifyCertificate = (verificationCode: string) => {
    window.open(`/verify/${verificationCode}`, '_blank');
  };

  const filteredCertificates = certificates.filter(cert =>
    cert.eventTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.verificationCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your certificates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">My Certificates</h1>
        <p className="text-gray-600">
          View, download, and verify your certificates from GDG Davao events.
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search certificates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <AcademicCapIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Certificates</p>
              <p className="text-2xl font-bold text-gray-900">{certificates.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Verified</p>
              <p className="text-2xl font-bold text-gray-900">
                {certificates.filter(c => c.status === 'verified').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Recently Issued</p>
              <p className="text-2xl font-bold text-gray-900">
                {certificates.filter(c => {
                  const issued = new Date(c.issuedDate);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return issued > weekAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Certificates Grid */}
      {filteredCertificates.length === 0 ? (
        <div className="text-center py-12">
          <AcademicCapIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No certificates found' : 'No certificates yet'}
          </h3>
          <p className="text-gray-500">
            {searchTerm 
              ? 'Try adjusting your search terms.' 
              : 'Attend GDG Davao events to earn certificates!'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCertificates.map((certificate) => (
            <div key={certificate.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
              {/* Certificate Preview */}
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 relative">
                <img
                  src={certificate.certificateUrl}
                  alt={`${certificate.eventTitle} Certificate`}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDQwMCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xODQgMTIwTDIwOCAxMDRMMjMyIDEyMEwyMDggMTM2TDE4NCAxMjBaIiBmaWxsPSIjOUI5QkEwIi8+Cjwvc3ZnPgo=';
                  }}
                />
                <div className="absolute top-3 right-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    certificate.status === 'verified'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {certificate.status === 'verified' ? 'Verified' : 'Issued'}
                  </span>
                </div>
              </div>

              {/* Certificate Details */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                  {certificate.eventTitle}
                </h3>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p>Event Date: {new Date(certificate.eventDate).toLocaleDateString()}</p>
                  <p>Issued: {new Date(certificate.issuedDate).toLocaleDateString()}</p>
                  <p className="font-mono text-xs">Code: {certificate.verificationCode}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => viewCertificate(certificate)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="View certificate"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadCertificate(certificate)}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="Download certificate"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => verifyCertificate(certificate.verificationCode)}
                      className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                      title="Verify certificate"
                    >
                      <QrCodeIcon className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <span className="text-xs text-gray-500">
                    Downloaded {certificate.downloadCount}x
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyCertificatesPage; 
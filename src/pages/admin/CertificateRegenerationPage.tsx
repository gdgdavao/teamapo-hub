import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { CertificateGenerationService } from '../../utils/certificateGeneration';
import { CertificateService } from '../../services/certificateService';
import { CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';

interface CertificateToFix {
  id: string;
  registrationId: string;
  recipientName: string;
  recipientEmail: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  templateId: string;
  verificationCode: string;
  certificateUrl: string;
  // Computed
  fullName?: string;
  needsFix?: boolean;
  status?: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface RegistrationData {
  customResponses?: Record<string, string | boolean | number>;
  userDetails?: {
    name?: string;
    email?: string;
  };
}

/**
 * Extract full name from registration customResponses
 * Combines First Name (field '1') + Last Name (field '1762143123275') for DevFest Davao
 */
const getFullNameFromRegistration = (regData: RegistrationData | null): string | null => {
  if (!regData) return null;
  
  const customResponses = regData.customResponses || {};
  const userDetails = regData.userDetails || {};
  
  // Field '1' is First Name, '1762143123275' is Last Name for DevFest Davao form
  const firstName = customResponses['1'] as string | undefined;
  const lastName = customResponses['1762143123275'] as string | undefined;
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`.trim();
  }
  
  return userDetails.name || firstName || null;
};

const CertificateRegenerationPage: React.FC = () => {
  const [certificates, setCertificates] = useState<CertificateToFix[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [eventId, setEventId] = useState('cGM6c5EiyIYWlzcZFnLh'); // DevFest Davao 2025

  // Load certificates that need fixing
  useEffect(() => {
    const loadCertificates = async () => {
      setLoading(true);
      try {
        // Get all certificates for the event
        const certsQuery = query(
          collection(db, 'certificates'),
          where('eventId', '==', eventId)
        );
        const certsSnapshot = await getDocs(certsQuery);
        
        const certsToFix: CertificateToFix[] = [];
        
        for (const certDoc of certsSnapshot.docs) {
          const certData = certDoc.data();
          
          // Get registration data to extract full name
          const regId = certData.registrationId;
          let fullName: string | null = null;
          
          if (regId) {
            try {
              const regRef = doc(db, 'registrations', regId);
              const regSnap = await getDoc(regRef);
              
              if (regSnap.exists()) {
                fullName = getFullNameFromRegistration(regSnap.data() as RegistrationData);
              }
            } catch (err) {
              logger.warn(`Could not fetch registration ${regId}:`, err);
            }
          }
          
          const needsFix = fullName && fullName !== certData.recipientName;
          
          certsToFix.push({
            id: certDoc.id,
            registrationId: certData.registrationId,
            recipientName: certData.recipientName,
            recipientEmail: certData.recipientEmail,
            eventId: certData.eventId,
            eventTitle: certData.eventTitle,
            eventDate: certData.eventDate,
            templateId: certData.templateId,
            verificationCode: certData.verificationCode || certData.credentialId,
            certificateUrl: certData.certificateUrl,
            fullName: fullName || certData.recipientName,
            needsFix,
            status: 'pending'
          });
        }
        
        setCertificates(certsToFix);
      } catch (err) {
        logger.error('Error loading certificates:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadCertificates();
  }, [eventId]);

  // Regenerate a single certificate
  const regenerateCertificate = async (cert: CertificateToFix): Promise<void> => {
    // Update status to processing
    setCertificates(prev => prev.map(c => 
      c.id === cert.id ? { ...c, status: 'processing' } : c
    ));
    
    try {
      // Get the template
      const template = await CertificateService.getTemplateById(cert.templateId);
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Generate new certificate with full name
      const result = await CertificateGenerationService.generateCertificate(template, {
        templateId: cert.templateId,
        recipientName: cert.fullName || cert.recipientName,
        recipientEmail: cert.recipientEmail,
        eventTitle: cert.eventTitle,
        eventDate: cert.eventDate,
        eventId: cert.eventId,
        verificationCode: cert.verificationCode // Keep the same verification code
      });
      
      // Upload to Firebase Storage (overwrite existing)
      const imageRef = ref(storage, `certificates/${cert.eventId}/${cert.verificationCode}.png`);
      await uploadBytes(imageRef, result.blob, { contentType: 'image/png' });
      const newUrl = await getDownloadURL(imageRef);
      
      // Update Firestore document with new name and URL
      const certRef = doc(db, 'certificates', cert.id);
      await updateDoc(certRef, {
        recipientName: cert.fullName || cert.recipientName,
        certificateUrl: newUrl,
        updatedAt: serverTimestamp(),
        regeneratedAt: serverTimestamp(),
        regenerationReason: 'Full name fix'
      });
      
      // Update local state
      setCertificates(prev => prev.map(c => 
        c.id === cert.id ? { 
          ...c, 
          status: 'success', 
          recipientName: cert.fullName || cert.recipientName,
          certificateUrl: newUrl
        } : c
      ));
      
    } catch (err) {
      logger.error(`Error regenerating certificate ${cert.id}:`, err);
      setCertificates(prev => prev.map(c => 
        c.id === cert.id ? { ...c, status: 'error', error: (err as Error).message } : c
      ));
    }
  };

  // Regenerate all certificates that need fixing
  const regenerateAll = async () => {
    const toFix = certificates.filter(c => c.needsFix && c.status !== 'success');
    setProcessing(true);
    setProgress({ current: 0, total: toFix.length });
    
    for (let i = 0; i < toFix.length; i++) {
      await regenerateCertificate(toFix[i]);
      setProgress({ current: i + 1, total: toFix.length });
      // Small delay to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setProcessing(false);
  };

  const needsFixCount = certificates.filter(c => c.needsFix).length;
  const successCount = certificates.filter(c => c.status === 'success').length;
  const errorCount = certificates.filter(c => c.status === 'error').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading certificates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Certificate Regeneration Tool</h1>
          <p className="text-gray-600 mb-4">
            Fix certificates that have incomplete names (first name only instead of full name).
          </p>
          
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Certificates</p>
              <p className="text-2xl font-bold text-gray-900">{certificates.length}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm text-yellow-600">Needs Fix</p>
              <p className="text-2xl font-bold text-yellow-700">{needsFixCount}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600">Fixed</p>
              <p className="text-2xl font-bold text-green-700">{successCount}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-600">Errors</p>
              <p className="text-2xl font-bold text-red-700">{errorCount}</p>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={regenerateAll}
              disabled={processing || needsFixCount === 0}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 ${processing ? 'animate-spin' : ''}`} />
              {processing 
                ? `Processing ${progress.current}/${progress.total}...` 
                : `Regenerate All (${needsFixCount})`
              }
            </button>
          </div>
          
          {/* Progress bar */}
          {processing && (
            <div className="mb-6">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Certificates table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Full Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verification Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {certificates.map(cert => (
                <tr key={cert.id} className={cert.needsFix ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {cert.status === 'success' && (
                      <span className="inline-flex items-center text-green-600">
                        <CheckCircleIcon className="h-5 w-5 mr-1" />
                        Fixed
                      </span>
                    )}
                    {cert.status === 'error' && (
                      <span className="inline-flex items-center text-red-600" title={cert.error}>
                        <ExclamationTriangleIcon className="h-5 w-5 mr-1" />
                        Error
                      </span>
                    )}
                    {cert.status === 'processing' && (
                      <span className="inline-flex items-center text-blue-600">
                        <ArrowPathIcon className="h-5 w-5 mr-1 animate-spin" />
                        Processing
                      </span>
                    )}
                    {cert.status === 'pending' && cert.needsFix && (
                      <span className="inline-flex items-center text-yellow-600">
                        <ExclamationTriangleIcon className="h-5 w-5 mr-1" />
                        Needs Fix
                      </span>
                    )}
                    {cert.status === 'pending' && !cert.needsFix && (
                      <span className="text-gray-400">OK</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cert.needsFix ? 'text-red-600 line-through' : 'text-gray-900'}>
                      {cert.recipientName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cert.needsFix ? 'text-green-600 font-medium' : 'text-gray-500'}>
                      {cert.fullName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cert.recipientEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {cert.verificationCode}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {cert.needsFix && cert.status !== 'success' && (
                      <button
                        onClick={() => regenerateCertificate(cert)}
                        disabled={processing || cert.status === 'processing'}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50 text-sm font-medium"
                      >
                        Regenerate
                      </button>
                    )}
                    {cert.certificateUrl && (
                      <a
                        href={cert.certificateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 text-gray-500 hover:text-gray-700 text-sm"
                      >
                        View
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CertificateRegenerationPage;


import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ExclamationTriangleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import usePageTitle from '../../hooks/usePageTitle';
import useSEO from '../../hooks/useSEO';
import FormRenderer from '../../components/shared/FormRenderer/FormRenderer';
import { EventService } from '../../services/eventService';
import { FeedbackService } from '../../services/feedbackService';
import { CertificateService } from '../../services/certificateService';
import { CertificateGenerationService } from '../../utils/certificateGeneration';
import { RegistrationService } from '../../services/registrationService';
import { Event, FormField, CertificateTemplate } from '../../types';
import { logger } from '../../utils/logger';

const FeedbackPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  
  // Support both token-based (secure) and legacy query params
  const token = searchParams.get('token');
  const legacyRegistrationId = searchParams.get('registrationId');
  const legacyEmail = searchParams.get('email');
  const legacyName = searchParams.get('name');

  // Resolved user data (from token or legacy params)
  const [registrationId, setRegistrationId] = useState<string | null>(legacyRegistrationId);
  const [userEmail, setUserEmail] = useState<string | null>(legacyEmail);
  const [userName, setUserName] = useState<string | null>(legacyName);
  const [tokenResolved, setTokenResolved] = useState(!token); // If no token, already resolved

  const [event, setEvent] = useState<Event | null>(null);
  const [feedbackForm, setFeedbackForm] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Certificate generation state
  const [generatingCertificate, setGeneratingCertificate] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);

  // Helper function to safely convert Firestore Timestamp or Date to Date object
  const toDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    
    // Handle Firestore Timestamp object
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Handle Date object
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Handle Firestore Timestamp serialized as object with seconds/nanoseconds
    if (dateValue.seconds !== undefined) {
      return new Date(dateValue.seconds * 1000);
    }
    
    // Handle ISO string or timestamp
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    // Fallback to current date if all else fails
    logger.warn('Unable to parse date:', dateValue);
    return new Date();
  };

  // Generate or retrieve certificate for user (extracted for reuse)
  const generateCertificateForUser = useCallback(async (
    certTemplate: CertificateTemplate,
    eventData: Event,
    regId: string,
    email: string,
    name: string
  ) => {
    if (!eventId) return;

    setGeneratingCertificate(true);
    setCertificateError(null);

    try {
      // Check if certificate already exists for this registration (consistent code per attendee)
      const existingCert = await CertificateService.getCertificateByRegistrationId(regId);
      
      if (existingCert?.certificateUrl && existingCert?.credentialId) {
        // Certificate already exists, use existing data
        setCertificateUrl(existingCert.certificateUrl);
        setVerificationCode(existingCert.credentialId);
        return;
      }

      // Get consistent verification code for this attendee (deterministic based on eventId + email + name)
      const consistentVerificationCode = await CertificateService.getConsistentVerificationCode(
        eventId,
        regId,
        email,
        name
      );

      // Generate certificate client-side with consistent verification code
      const result = await CertificateGenerationService.generateCertificate(certTemplate, {
        templateId: certTemplate.id,
        recipientName: name,
        recipientEmail: email,
        eventTitle: eventData.title,
        eventDate: toDate(eventData.startDate).toISOString(),
        eventId,
        verificationCode: consistentVerificationCode
      });

      // Upload certificate to Firebase Storage
      const storageUrl = await CertificateService.saveCertificateToStorage(
        result.blob,
        eventId,
        result.verificationCode
      );

      // Save certificate record to Firestore
      await CertificateService.createCertificateRecord({
        recipientName: name,
        recipientEmail: email,
        eventId,
        eventTitle: eventData.title,
        eventDate: toDate(eventData.startDate).toISOString(),
        registrationId: regId,
        certificateUrl: storageUrl,
        verificationCode: result.verificationCode,
        templateId: certTemplate.id
      });

      setCertificateUrl(result.certificateUrl);
      setVerificationCode(result.verificationCode);
    } catch (err) {
      logger.error('Error generating certificate:', err);
      setCertificateError('Failed to generate certificate. You can try again or contact support.');
    } finally {
      setGeneratingCertificate(false);
    }
  }, [eventId]);

  // Set page title and SEO
  usePageTitle({ title: `Event Feedback${event ? ` - ${event.title}` : ''}` });
  useSEO({
    title: `Event Feedback${event ? ` - ${event.title}` : ''}`,
    description: event ? `Share your feedback for ${event.title}` : 'Share your event feedback',
    keywords: 'event feedback, survey, gdg davao'
  });

  // Resolve feedback token if present
  useEffect(() => {
    const resolveToken = async () => {
      if (!token || !eventId) {
        setTokenResolved(true);
        return;
      }

      try {
        const tokenData = await FeedbackService.resolveFeedbackToken(token, eventId);
        setRegistrationId(tokenData.registrationId);
        setUserEmail(tokenData.email);
        setUserName(tokenData.name);
        setTokenResolved(true);
      } catch (err) {
        logger.error('Error resolving feedback token:', err);
        setError('Invalid or expired feedback link. Please contact the organizer for a new link.');
        setTokenResolved(true);
        setLoading(false);
      }
    };

    resolveToken();
  }, [token, eventId]);

  useEffect(() => {
    const loadEventAndForm = async () => {
      if (!eventId) {
        setError('Event ID is required');
        setLoading(false);
        return;
      }

      // Wait for token resolution before loading
      if (!tokenResolved) {
        return;
      }

      try {
        // Load event details
        const eventData = await EventService.getEvent(eventId);
        setEvent(eventData);

        // Check if feedback was already submitted for this registration
        if (registrationId && userEmail && userName) {
          // First try to get registration (returns null for anonymous users due to permissions)
          const registration = await RegistrationService.getRegistrationById(registrationId);
          
          if (registration?.feedbackSubmitted) {
            // Feedback already submitted - skip to certificate generation/display
            setSubmitted(true);
            
            // Check for certificate template and generate/retrieve certificate
            const certTemplate = await CertificateService.getTemplateForEvent(eventId);
            if (certTemplate) {
              setTemplate(certTemplate);
              // This will either retrieve existing certificate or generate new one
              await generateCertificateForUser(certTemplate, eventData, registrationId, userEmail, userName);
            }
            setLoading(false);
            return;
          }
          
          // If registration is null (permission denied for anonymous users), check certificate instead
          if (!registration) {
            const existingCert = await CertificateService.getCertificateByRegistrationId(registrationId);
            if (existingCert?.certificateUrl && existingCert?.credentialId) {
              // Certificate exists means feedback was already submitted
              setSubmitted(true);
              setCertificateUrl(existingCert.certificateUrl);
              setVerificationCode(existingCert.credentialId);
              
              // Try to load template for retry functionality
              const certTemplate = await CertificateService.getTemplateForEvent(eventId);
              if (certTemplate) {
                setTemplate(certTemplate);
              }
              setLoading(false);
              return;
            }
          }
        }

        // Load feedback form (only if feedback not yet submitted)
        const formData = await EventService.getFeedbackForm(eventId);
        setFeedbackForm(formData.fields);
      } catch (err) {
        logger.error('Error loading event or feedback form:', err);
        setError('Failed to load feedback form. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadEventAndForm();
  }, [eventId, tokenResolved, registrationId, userEmail, userName, generateCertificateForUser]);

  // Generate certificate after feedback submission
  const generateCertificate = async (certTemplate: CertificateTemplate) => {
    if (!event || !registrationId || !userEmail || !userName) return;
    await generateCertificateForUser(certTemplate, event, registrationId, userEmail, userName);
  };

  const handleFeedbackSubmit = async (formData: Record<string, any>) => {
    if (!eventId || !event) return;

    setSubmitting(true);
    setError(null);

    try {
      // Extract overall rating (required field)
      const overallRating = formData.overall_rating || 5;
      
      // Prepare feedback data
      const feedbackData = {
        eventId,
        registrationId: registrationId || undefined,
        userEmail: userEmail || formData.email || 'anonymous@example.com',
        userName: userName || formData.name || 'Anonymous',
        responses: formData,
        overallRating,
        contentRating: formData.content_rating,
        organizationRating: formData.organization_rating,
        venueRating: formData.venue_rating,
        comments: formData.comments || formData.liked_most || '',
        suggestions: formData.suggestions || formData.improvements || '',
        wouldRecommend: formData.would_recommend || false,
        futureTopics: formData.future_topics || []
      };

      await FeedbackService.submitFeedback(feedbackData);
      setSubmitted(true);

      // Generate certificate if template exists for this event
      if (registrationId && userEmail && userName) {
        const certTemplate = await CertificateService.getTemplateForEvent(eventId);
        if (certTemplate) {
          setTemplate(certTemplate);
          await generateCertificate(certTemplate);
        }
      }
    } catch (err) {
      logger.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle certificate download
  const handleDownloadCertificate = () => {
    if (certificateUrl && userName && event) {
      CertificateGenerationService.downloadCertificate(
        certificateUrl,
        `${userName.replace(/\s+/g, '_')}_${event.title.replace(/\s+/g, '_')}_Certificate.png`
      );
    }
  };

  // Handle retry certificate generation
  const handleRetryCertificate = () => {
    if (template) {
      generateCertificate(template);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Just a moment...</p>
          <p className="text-gray-400 text-sm mt-1">Preparing your feedback form</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Refresh Page
          </button>
          <p className="text-xs text-gray-400 mt-4">If this problem persists, please contact the event organizer.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    // Check if this is a returning user (certificate already exists)
    const isReturningUser = certificateUrl && !generatingCertificate;
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {isReturningUser ? 'Welcome Back!' : 'Thank You!'}
          </h1>
          <p className="text-gray-600 mb-6">
            {isReturningUser 
              ? 'Your feedback was already submitted. Here\'s your certificate of participation!'
              : 'Your feedback has been submitted successfully. We truly appreciate your time and input!'
            }
          </p>
          
          {/* Certificate Section */}
          {registrationId && (
            <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-center mb-4">
                <span className="text-3xl">🎓</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-4">
                Certificate of Participation
              </p>
              
              {/* Loading State with Skeleton */}
              {generatingCertificate && (
                <div className="space-y-4">
                  {/* Certificate Skeleton */}
                  <div className="relative border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-gray-100 aspect-[11/8.5]">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" 
                         style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                      {/* Decorative border skeleton */}
                      <div className="absolute inset-4 border-2 border-gray-200 rounded-lg opacity-50" />
                      
                      {/* Logo placeholder */}
                      <div className="w-16 h-16 bg-gray-200 rounded-full mb-4" />
                      
                      {/* Title skeleton */}
                      <div className="h-6 w-48 bg-gray-200 rounded mb-2" />
                      
                      {/* Subtitle skeleton */}
                      <div className="h-4 w-32 bg-gray-200 rounded mb-6" />
                      
                      {/* Name skeleton */}
                      <div className="h-8 w-56 bg-gray-200 rounded mb-4" />
                      
                      {/* Description skeleton */}
                      <div className="h-3 w-64 bg-gray-200 rounded mb-2" />
                      <div className="h-3 w-48 bg-gray-200 rounded mb-6" />
                      
                      {/* QR code placeholder */}
                      <div className="w-16 h-16 bg-gray-200 rounded" />
                    </div>
                  </div>
                  
                  {/* Verification code skeleton */}
                  <div className="bg-white/70 rounded-lg px-4 py-3">
                    <div className="h-3 w-24 bg-gray-200 rounded mx-auto mb-2" />
                    <div className="h-6 w-40 bg-gray-200 rounded mx-auto" />
                  </div>
                  
                  {/* Button skeleton */}
                  <div className="h-12 w-full bg-gray-200 rounded-lg" />
                  
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Creating your certificate...</p>
                    <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
                  </div>
                </div>
              )}
              
              {/* Error State */}
              {certificateError && !generatingCertificate && (
                <div className="py-4">
                  <ExclamationTriangleIcon className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700 mb-2">Certificate Generation Failed</p>
                  <p className="text-xs text-gray-500 mb-4">Don't worry, your feedback was saved. You can try generating again.</p>
                  {template && (
                    <button
                      onClick={handleRetryCertificate}
                      className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Try Again
                    </button>
                  )}
                </div>
              )}
              
              {/* Certificate Preview & Download */}
              {certificateUrl && !generatingCertificate && (
                <div className="space-y-4">
                  {/* Preview Image */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <img 
                      src={certificateUrl} 
                      alt="Your Certificate of Participation"
                      className="w-full h-auto"
                    />
                  </div>
                  
                  {/* Verification Code */}
                  {verificationCode && (
                    <div className="bg-white/70 rounded-lg px-4 py-3">
                      <p className="text-xs text-gray-500 mb-1">Certificate Verification Code</p>
                      <div className="flex items-center justify-center gap-2">
                        <code className="text-sm font-mono font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded">
                          {verificationCode}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(verificationCode);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Copy to clipboard"
                          aria-label="Copy verification code"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Use this code to verify your certificate authenticity</p>
                    </div>
                  )}
                  
                  {/* Download Button */}
                  <button
                    onClick={() => {
                      const filename = `Certificate_${event?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Event'}_${userName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Participant'}.png`;
                      CertificateGenerationService.downloadCertificate(certificateUrl, filename);
                    }}
                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                    Download Certificate
                  </button>
                </div>
              )}
              
              {/* Fallback: No certificate available - contact support */}
              {!generatingCertificate && !certificateUrl && !certificateError && (
                <div className="py-4 text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Having trouble with your certificate?
                  </p>
                  <p className="text-sm text-gray-500">
                    Please contact us at{' '}
                    <a 
                      href="mailto:support@gdgdavao.org" 
                      className="text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      support@gdgdavao.org
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
          
          {event && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                {event.title}
              </p>
              <p className="text-sm text-blue-700">
                {toDate(event.startDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}
          
          <p className="text-xs text-gray-400 mt-6">
            Thank you for being part of our community! 💙
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Share Your Feedback</h1>
          <p className="text-gray-500 mb-6">We'd love to hear about your experience!</p>
          {event && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{event.title}</h2>
              <p className="text-gray-600">
                {toDate(event.startDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })} • {event.venue.type === 'online' ? 'Online Event' : event.venue.name || 'TBA'}
              </p>
              {userName && (
                <p className="text-sm text-blue-600 mt-3 font-medium">
                  👋 Hi {userName.split(' ')[0]}! Thanks for attending.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Feedback Form */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <FormRenderer
            fields={feedbackForm}
            onSubmit={handleFeedbackSubmit}
            submitButtonText={submitting ? "Submitting..." : "Submit Feedback"}
            disabled={submitting}
            className="space-y-6"
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Powered by TeamApo Hub • GDG Davao
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage; 
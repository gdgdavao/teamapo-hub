
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ExclamationTriangleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import usePageTitle from '../../hooks/usePageTitle';
import useSEO from '../../hooks/useSEO';
import FormRenderer from '../../components/shared/FormRenderer/FormRenderer';
import { EventService } from '../../services/eventService';
import { FeedbackService } from '../../services/feedbackService';
import { CertificateService } from '../../services/certificateService';
import { CertificateGenerationService } from '../../utils/certificateGeneration';
import { Event, FormField, CertificateTemplate } from '../../types';

const FeedbackPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const registrationId = searchParams.get('registrationId');
  const userEmail = searchParams.get('email');
  const userName = searchParams.get('name');

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
    console.warn('Unable to parse date:', dateValue);
    return new Date();
  };

  // Set page title and SEO
  usePageTitle({ title: `Event Feedback${event ? ` - ${event.title}` : ''}` });
  useSEO({
    title: `Event Feedback${event ? ` - ${event.title}` : ''}`,
    description: event ? `Share your feedback for ${event.title}` : 'Share your event feedback',
    keywords: 'event feedback, survey, gdg davao'
  });

  useEffect(() => {
    const loadEventAndForm = async () => {
      if (!eventId) {
        setError('Event ID is required');
        setLoading(false);
        return;
      }

      try {
        // Load event details
        const eventData = await EventService.getEvent(eventId);
        setEvent(eventData);

        // Load feedback form
        const formData = await EventService.getFeedbackForm(eventId);
        setFeedbackForm(formData.fields);
      } catch (err) {
        console.error('Error loading event or feedback form:', err);
        setError('Failed to load feedback form. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadEventAndForm();
  }, [eventId]);

  // Generate certificate after feedback submission
  const generateCertificate = async (certTemplate: CertificateTemplate) => {
    if (!event || !eventId || !registrationId || !userEmail || !userName) return;

    setGeneratingCertificate(true);
    setCertificateError(null);

    try {
      // Generate certificate client-side
      const result = await CertificateGenerationService.generateCertificate(certTemplate, {
        templateId: certTemplate.id,
        recipientName: userName,
        recipientEmail: userEmail,
        eventTitle: event.title,
        eventDate: toDate(event.startDate).toISOString()
      });

      // Upload certificate to Firebase Storage
      const storageUrl = await CertificateService.saveCertificateToStorage(
        result.blob,
        eventId,
        result.verificationCode
      );

      // Save certificate record to Firestore
      await CertificateService.createCertificateRecord({
        recipientName: userName,
        recipientEmail: userEmail,
        eventId,
        eventTitle: event.title,
        eventDate: toDate(event.startDate).toISOString(),
        registrationId,
        certificateUrl: storageUrl,
        verificationCode: result.verificationCode,
        templateId: certTemplate.id
      });

      setCertificateUrl(result.certificateUrl);
      setVerificationCode(result.verificationCode);
    } catch (err) {
      console.error('Error generating certificate:', err);
      setCertificateError('Failed to generate certificate. You can try again or contact support.');
    } finally {
      setGeneratingCertificate(false);
    }
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
      console.error('Error submitting feedback:', err);
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
          <p className="text-gray-600">Loading feedback form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            Your feedback has been submitted successfully. We appreciate your time and input!
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
              
              {/* Loading State */}
              {generatingCertificate && (
                <div className="py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-sm text-gray-600">Generating your certificate...</p>
                </div>
              )}
              
              {/* Error State */}
              {certificateError && !generatingCertificate && (
                <div className="py-4">
                  <ExclamationTriangleIcon className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
                  <p className="text-sm text-red-600 mb-4">{certificateError}</p>
                  {template && (
                    <button
                      onClick={handleRetryCertificate}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                      Retry Generation
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
                      <p className="text-xs text-gray-500 mb-1">Verification Code</p>
                      <div className="flex items-center justify-center gap-2">
                        <code className="text-sm font-mono font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded">
                          {verificationCode}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(verificationCode);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Copy verification code"
                          aria-label="Copy verification code"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
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
              
              {/* No Template Available */}
              {!template && !generatingCertificate && !certificateUrl && !certificateError && (
                <div className="py-4">
                  <p className="text-sm text-gray-600">
                    Certificate generation is not available for this event at the moment.
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Your feedback helps us improve our future events.
            </p>
            {event && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  Event: {event.title}
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Event Feedback</h1>
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
              <p className="text-sm text-gray-500 mt-2">
                Your feedback is valuable and helps us improve our future events.
              </p>
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
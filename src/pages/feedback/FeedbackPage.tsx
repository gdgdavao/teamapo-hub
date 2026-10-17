
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { InformationCircleIcon } from '@heroicons/react/20/solid';
import usePageTitle from '../../hooks/usePageTitle';
import useSEO from '../../hooks/useSEO';
import FormRenderer from './components/FormRenderer';
import {
  Button,
  Card,
  EmptyState,
  LoadingSpinner
} from '../../components/UI';
import { EventService } from '../../services/eventService';
import { FeedbackService } from '../../services/feedbackService';
import { CertificateService } from '../../services/certificateService';
import { CertificateGenerationService } from '../../utils/certificateGeneration';
import { RegistrationService } from '../../services/registrationService';
import { Event, FormField, CertificateTemplate, Registration } from '../../types';
import { toDateSafe } from '../../utils/dateUtils';
import { formatEventLocation } from '../../utils/venueUtils';
import { logger } from '../../utils/logger';

/**
 * Extract full name from registration customResponses
 * Combines First Name + Last Name from customResponses for forms with separate name fields
 * 
 * Common field mappings:
 * - Field '1': First Name (DevFest Davao form)
 * - Field '1762143123275': Last Name (DevFest Davao form)
 * - Also checks for common variations like 'firstName', 'first_name', 'lastName', 'last_name'
 * 
 * Falls back to userDetails.name if customResponses don't have the fields
 */
const getFullNameFromRegistration = (registration: Registration | null): string | null => {
  if (!registration) return null;
  
  const customResponses = registration.customResponses || {};
  const userDetails = registration.userDetails;
  
  // Try to find first name and last name from customResponses
  // Support multiple field naming conventions
  const firstNameFields = ['1', 'firstName', 'first_name', 'First Name', 'first name'];
  const lastNameFields = ['1762143123275', 'lastName', 'last_name', 'Last Name', 'last name'];
  
  let firstName: string | undefined;
  let lastName: string | undefined;
  
  // Find first name
  for (const field of firstNameFields) {
    const value = customResponses[field];
    if (typeof value === 'string' && value.trim()) {
      firstName = value.trim();
      break;
    }
  }
  
  // Find last name
  for (const field of lastNameFields) {
    const value = customResponses[field];
    if (typeof value === 'string' && value.trim()) {
      lastName = value.trim();
      break;
    }
  }
  
  // If we found both first and last name, combine them
  if (firstName && lastName) {
    return `${firstName} ${lastName}`.trim();
  }
  
  // Fall back to userDetails.name
  if (userDetails?.name) return userDetails.name;
  
  // Last resort: return first name only if available
  return firstName || null;
};

const FeedbackPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  
  // Strict token-based feedback access from email links
  const token = searchParams.get('token');

  // Resolved user data (populated exclusively via verified server-side token)
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [tokenResolved, setTokenResolved] = useState(!token); // If no token, already resolved as anonymous

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
    return toDateSafe(dateValue) ?? new Date();
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
        if (registrationId && userEmail) {
          // First try to get registration (returns null for anonymous users due to permissions)
          const registration = await RegistrationService.getRegistrationById(registrationId);
          
          // Extract full name from registration customResponses if available
          // This fixes the issue where token only has first name
          const fullName = getFullNameFromRegistration(registration) || userName;
          if (fullName && fullName !== userName) {
            setUserName(fullName);
          }
          const nameForCertificate = fullName || userName || 'Attendee';
          
          if (registration?.feedbackSubmitted) {
            // Feedback already submitted - skip to certificate generation/display
            setSubmitted(true);
            
            // Check for certificate template and generate/retrieve certificate
            const certTemplate = await CertificateService.getTemplateForEvent(eventId);
            if (certTemplate) {
              setTemplate(certTemplate);
              // This will either retrieve existing certificate or generate new one
              await generateCertificateForUser(certTemplate, eventData, registrationId, userEmail, nameForCertificate);
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
      <div className="min-h-page bg-surface-container-low flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" text="Preparing your feedback form" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-page bg-surface-container-low flex items-center justify-center px-4">
        <Card className="w-full max-w-md" padding="lg">
          <EmptyState
            icon={<ExclamationTriangleIcon className="h-10 w-10" />}
            title="Oops! Something went wrong"
            description={error}
            action={<Button onClick={() => window.location.reload()}>Refresh Page</Button>}
          />
          <p className="mt-4 text-center text-sm text-on-surface-variant">
            If this problem persists, please contact the event organizer.
          </p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    // Check if this is a returning user (certificate already exists)
    const isReturningUser = certificateUrl && !generatingCertificate;
    
return (
      <div className="min-h-page bg-surface-container-low flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-lg" padding="lg">
          <EmptyState
            icon={<CheckCircleIcon className="h-12 w-12" />}
            title={isReturningUser ? 'Welcome Back!' : 'Thank You!'}
            description={
              isReturningUser
                ? 'Your feedback was already submitted. Here is your certificate of participation!'
                : 'Your feedback has been submitted successfully. We truly appreciate your time and input!'
            }
          />
          
          {/* Certificate Section */}
          {registrationId && (
            <div className="mb-6 rounded-lg border border-primary-container bg-primary-container p-8">
              <div className="mb-4 flex items-center justify-center">
                <AcademicCapIcon className="h-10 w-10 text-primary" aria-hidden="true" />
              </div>
              <p className="mb-4 text-center text-lg font-semibold text-on-primary-container">
                Certificate of Participation
              </p>

              {/* Loading State with Skeleton */}
              {generatingCertificate && (
                <div className="space-y-4" role="status" aria-live="polite">
                  <span className="sr-only">Creating your certificate</span>
                  {/* Certificate Skeleton */}
                  <div className="relative overflow-hidden rounded-lg border border-outline-variant bg-surface-container aspect-[11/8.5]">
                    {/* `animate-shimmer-sweep` is the real keyframe. The previous
                        `animate-shimmer` class resolved to nothing and the inline
                        `animation: shimmer` pointed at an undefined @keyframes, so
                        the sheen never moved. */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface/60 to-transparent animate-shimmer-sweep motion-reduce:animate-none" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                      {/* Decorative border skeleton */}
                      <div className="absolute inset-4 rounded-lg border-2 border-surface-dim opacity-50" />

                      {/* Logo placeholder */}
                      <div className="mb-4 h-16 w-16 rounded-full bg-surface-dim" />

                      {/* Title skeleton */}
                      <div className="mb-2 h-6 w-48 rounded bg-surface-dim" />

                      {/* Subtitle skeleton */}
                      <div className="mb-6 h-4 w-32 rounded bg-surface-dim" />

                      {/* Name skeleton */}
                      <div className="mb-4 h-8 w-56 rounded bg-surface-dim" />

                      {/* Description skeleton */}
                      <div className="mb-2 h-3 w-64 rounded bg-surface-dim" />
                      <div className="mb-6 h-3 w-48 rounded bg-surface-dim" />

                      {/* QR code placeholder */}
                      <div className="h-16 w-16 rounded bg-surface-dim" />
                    </div>
                  </div>

                  {/* Verification code skeleton */}
                  <div className="rounded-lg bg-surface/70 px-4 py-3">
                    <div className="mx-auto mb-2 h-3 w-24 rounded bg-surface-dim" />
                    <div className="mx-auto h-6 w-40 rounded bg-surface-dim" />
                  </div>

                  {/* Button skeleton */}
                  <div className="h-control w-full rounded-lg bg-surface-dim" />

                  <div className="text-center">
                    <p className="text-sm font-medium text-on-surface-variant">Creating your certificate...</p>
                    <p className="mt-1 text-sm text-on-surface-variant">This may take a few seconds</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {certificateError && !generatingCertificate && (
                <div className="py-4 text-center">
                  <ExclamationTriangleIcon className="mx-auto mb-3 h-10 w-10 text-warning" aria-hidden="true" />
                  <p className="mb-2 text-sm font-medium text-on-surface">Certificate Generation Failed</p>
                  <p className="mb-4 text-sm text-on-surface-variant">Don't worry, your feedback was saved. You can try generating again.</p>
                  {template && (
                    <Button
                      size="sm"
                      icon={<ArrowPathIcon />}
                      onClick={handleRetryCertificate}
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              )}

              {/* Certificate Preview & Download */}
              {certificateUrl && !generatingCertificate && (
                <div className="space-y-4">
                  {/* Preview Image */}
                  <div className="overflow-hidden rounded-lg border border-outline-variant">
                    <img
                      src={certificateUrl}
                      alt="Your Certificate of Participation"
                      className="h-auto w-full"
                    />
                  </div>

                  {/* Verification Code */}
                  {verificationCode && (
                    <div className="rounded-lg bg-surface/70 px-4 py-3">
                      <p className="mb-1 text-sm text-on-surface-variant">Certificate Verification Code</p>
                      <div className="flex items-center justify-center gap-2">
                        <code className="min-w-0 truncate rounded bg-surface-container px-3 py-1.5 font-mono text-sm font-semibold text-on-surface">
                          {verificationCode}
                        </code>
                        {/* Was a 28px icon button wedged next to the code. A thumb
                            reaching for it misses, so it now carries the same 48px
                            floor as every other control. */}
                        <Button
                          variant="text"
                          onClick={() => navigator.clipboard.writeText(verificationCode)}
                          title="Copy to clipboard"
                          aria-label="Copy verification code"
                          className="min-h-control min-w-[48px] shrink-0 px-2xs"
                          icon={<ClipboardDocumentIcon />}
                        />
                      </div>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        Use this code to verify your certificate authenticity
                      </p>
                    </div>
                  )}

                  {/* Download Button */}
                  <Button
                    fullWidth
                    icon={<ArrowDownTrayIcon />}
                    onClick={() => {
                      const filename = `Certificate_${event?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Event'}_${userName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Participant'}.png`;
                      CertificateGenerationService.downloadCertificate(certificateUrl, filename);
                    }}
                  >
                    Download Certificate
                  </Button>
                </div>
              )}

              {/* Fallback: No certificate available - contact support */}
              {!generatingCertificate && !certificateUrl && !certificateError && (
                <div className="py-4 text-center">
                  <p className="mb-2 text-sm text-on-surface-variant">
                    Having trouble with your certificate?
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    Please contact us at{' '}
                    <a
                      href="mailto:support@gdgdavao.org"
                      className="font-medium text-primary underline hover:text-primary-hover"
                    >
                      support@gdgdavao.org
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

          {event && (
            <div className="rounded-lg bg-surface-container-low p-4 text-left">
              <p className="min-w-0 truncate text-sm font-medium text-on-surface">
                {event.title}
              </p>
              <p className="text-sm text-on-surface-variant">
                {toDate(event.startDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            Thank you for being part of our community!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-page bg-surface-container-low">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-on-surface mb-2">Share Your Feedback</h1>
          <p className="text-on-surface-variant mb-6">We'd love to hear about your experience!</p>
          {event && (
            <Card padding="lg" className="mb-8 text-left">
              <h2 className="mb-2 text-xl font-semibold text-on-surface break-words">{event.title}</h2>
              <p className="text-on-surface-variant break-words">
                {toDate(event.startDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })} • {formatEventLocation(event.venue)}
              </p>
              {userName && (
                <p className="mt-3 text-sm font-medium text-primary break-words">
                  Hi {userName.split(' ')[0]}! Thanks for attending.
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Anonymous Feedback Notice when accessing without email token */}
        {!token && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-left">
            <InformationCircleIcon className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-on-surface">Submitting General Feedback</p>
              <p className="text-on-surface-variant">
                You are submitting feedback anonymously. If you are an attendee seeking your Certificate of Participation, please open this form from the personalized feedback link emailed to your registered address.
              </p>
            </div>
          </div>
        )}

        {/* Feedback Form */}
        <Card padding="lg">
          <FormRenderer
            fields={feedbackForm}
            onSubmit={handleFeedbackSubmit}
            submitButtonText={submitting ? "Submitting..." : "Submit Feedback"}
            disabled={submitting}
            className="space-y-6"
          />
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-on-surface-variant">
            Powered by TeamApo Hub • GDG Davao
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage; 
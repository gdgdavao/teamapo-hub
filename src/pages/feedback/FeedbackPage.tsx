
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { InformationCircleIcon } from '@heroicons/react/20/solid';
import usePageTitle from '../../hooks/usePageTitle';
import useSEO from '../../hooks/useSEO';
import FormRenderer from './components/FormRenderer';
import {
  Button,
  Card,
  Badge,
  EmptyState,
  LoadingSpinner,
  toast
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

// 28 pure-CSS celebratory confetti pieces in GDG brand colors
const CONFETTI_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#0b57d0', '#186a3b'];
const CONFETTI_PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 3.5 + (i % 5) * 1.6) % 96}%`,
  top: `${-10 - (i % 6) * 10}px`,
  size: 6 + (i % 4) * 2.5,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: `${(i * 0.08).toFixed(2)}s`,
  duration: `${(2.2 + (i % 5) * 0.25).toFixed(2)}s`,
  rotation: (i * 47) % 360,
}));

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
  const [copiedCode, setCopiedCode] = useState(false);

  // Helper function to safely convert Firestore Timestamp or Date to Date object
  const toDate = (dateValue: any): Date => {
    return toDateSafe(dateValue) ?? new Date();
  };

  // Copy code with cross-browser clipboard fallback
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

  // LinkedIn Certification URL generator
  const getLinkedInCertificationUrl = () => {
    if (!event || !verificationCode) return '';
    const baseUrl = 'https://www.linkedin.com/profile/add';
    const params = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: `Certificate of Participation - ${event.title}`,
      organizationName: 'Google Developer Groups Davao',
      issueYear: String(new Date().getFullYear()),
      issueMonth: String(new Date().getMonth() + 1),
      certUrl: `${window.location.origin}/verify/${verificationCode}`,
      certId: verificationCode,
    });
    return `${baseUrl}?${params.toString()}`;
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
  usePageTitle({
    title: 'Event Feedback',
    contextTitle: event?.title,
  });
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
    const isReturningUser = Boolean(certificateUrl && !generatingCertificate);

    return (
      <div className="min-h-page bg-surface-container-low flex items-center justify-center py-12 px-4 relative overflow-hidden">
        {/* Google 4-Color Signature Accent Strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10" aria-hidden="true">
          <div className="h-full w-1/4 bg-[#4285F4]" />
          <div className="h-full w-1/4 bg-[#EA4335]" />
          <div className="h-full w-1/4 bg-[#FBBC04]" />
          <div className="h-full w-1/4 bg-[#34A853]" />
        </div>

        {/* Floating Confetti Particle Burst */}
        {CONFETTI_PIECES.map((piece, i) => (
          <div
            key={i}
            className="absolute rounded-sm pointer-events-none motion-reduce:hidden animate-confetti-fall"
            style={{
              left: piece.left,
              top: piece.top,
              backgroundColor: piece.color,
              width: `${piece.size}px`,
              height: `${piece.size * 1.5}px`,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              transform: `rotate(${piece.rotation}deg)`,
              zIndex: 20,
            }}
            aria-hidden="true"
          />
        ))}

        <Card className="w-full max-w-xl relative z-10 shadow-elevation-2" padding="lg">
          <div className="text-center mb-6">
            <div className="mb-3 inline-flex rounded-full bg-success-container p-3 animate-success-pop motion-reduce:animate-none">
              <CheckCircleIcon className="h-10 w-10 text-success" aria-hidden="true" />
            </div>
            <div className="flex justify-center mb-2">
              <Badge tone={isReturningUser ? 'info' : 'success'} pulse={!isReturningUser}>
                {isReturningUser ? 'Welcome Back!' : 'Feedback Recorded! 🎉'}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              {isReturningUser ? 'Your Certificate of Participation' : 'Thank You for Your Feedback!'}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-md mx-auto">
              {isReturningUser
                ? 'Your feedback was already submitted. Here is your official verifiable credential.'
                : 'Your input directly helps GDG Davao make future community events even better!'}
            </p>
          </div>

          {/* Certificate Section */}
          {registrationId && (
            <div className="mb-6 rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:p-6 shadow-elevation-1 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-outline-variant">
                <div className="flex items-center gap-2">
                  <AcademicCapIcon className="h-6 w-6 text-primary shrink-0" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-on-surface">Certificate of Participation</h2>
                </div>
                <Badge tone="success">
                  Authentic Credential
                </Badge>
              </div>

              {/* Loading State with Shimmer Skeleton */}
              {generatingCertificate && (
                <div className="space-y-4" role="status" aria-live="polite">
                  <span className="sr-only">Creating your certificate</span>
                  <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container aspect-[11/8.5]">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface/60 to-transparent animate-shimmer-sweep motion-reduce:animate-none" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <div className="mx-auto mb-3 h-10 w-10 rounded-full border-b-2 border-primary motion-essential animate-spin" />
                      <p className="text-sm font-medium text-on-surface">Generating your certificate...</p>
                      <p className="mt-1 text-xs text-on-surface-variant">Signing verifiable credential</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error State */}
              {certificateError && !generatingCertificate && (
                <div className="py-6 text-center">
                  <ExclamationTriangleIcon className="mx-auto mb-3 h-10 w-10 text-warning" aria-hidden="true" />
                  <p className="mb-1 text-base font-medium text-on-surface">Certificate Generation Paused</p>
                  <p className="mb-4 text-sm text-on-surface-variant">
                    Your feedback was saved safely. You can retry generating your certificate below.
                  </p>
                  {template && (
                    <Button
                      size="sm"
                      icon={<ArrowPathIcon />}
                      onClick={handleRetryCertificate}
                    >
                      Retry Generation
                    </Button>
                  )}
                </div>
              )}

              {/* Certificate Preview & Download */}
              {certificateUrl && !generatingCertificate && (
                <div className="space-y-4">
                  {/* Preview Image with 3D hover depth and shine */}
                  <div className="group relative overflow-hidden rounded-xl border border-outline-variant bg-surface certificate-card-tilt shadow-elevation-1">
                    <div
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-card-shine motion-reduce:hidden"
                      aria-hidden="true"
                    />
                    <img
                      src={certificateUrl}
                      alt={`Certificate of Participation for ${userName || 'Attendee'}`}
                      className="h-auto w-full object-contain"
                    />
                  </div>

                  {/* Verification Code Box with 1-Click Copy */}
                  {verificationCode && (
                    <div className="rounded-xl border border-outline-variant bg-surface p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                          Verification Code
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          Cryptographically signed
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container px-3 py-2">
                        <code className="min-w-0 font-mono text-sm sm:text-base font-semibold text-primary select-all truncate">
                          {verificationCode}
                        </code>
                        <Button
                          variant={copiedCode ? 'tonal' : 'text'}
                          size="sm"
                          onClick={() => copyVerificationCode(verificationCode)}
                          title="Copy verification code"
                          aria-label="Copy verification code"
                          icon={copiedCode ? <CheckIcon className="text-success" /> : <ClipboardDocumentIcon />}
                          className="min-h-control shrink-0 px-3"
                        >
                          {copiedCode ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action Cluster */}
                  <div className="space-y-2 pt-2">
                    <Button
                      fullWidth
                      size="lg"
                      icon={<ArrowDownTrayIcon />}
                      onClick={handleDownloadCertificate}
                    >
                      Download Certificate
                    </Button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {verificationCode && (
                        <Button
                          variant="tonal"
                          fullWidth
                          href={`/verify/${verificationCode}`}
                          icon={<ShieldCheckIcon />}
                        >
                          Verify Online
                        </Button>
                      )}

                      {verificationCode && (
                        <a
                          href={getLinkedInCertificationUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-control items-center justify-center gap-2 rounded border border-outline px-control-x font-medium text-on-surface hover:bg-surface-container transition-colors duration-short2 text-sm sm:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
                          <span>Add to LinkedIn</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback support contact */}
              {!generatingCertificate && !certificateUrl && !certificateError && (
                <div className="py-4 text-center">
                  <p className="text-sm text-on-surface-variant">
                    Need help claiming your certificate? Contact us at{' '}
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

          {/* Event Details Card */}
          {event && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                Event
              </p>
              <p className="min-w-0 truncate text-sm font-semibold text-on-surface">
                {event.title}
              </p>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                {toDate(event.startDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-on-surface-variant">
            Powered by TeamApo Hub • Google Developer Groups Davao
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-page bg-surface-container-low relative">
      {/* Google 4-Color Signature Accent Strip */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10" aria-hidden="true">
        <div className="h-full w-1/4 bg-[#4285F4]" />
        <div className="h-full w-1/4 bg-[#EA4335]" />
        <div className="h-full w-1/4 bg-[#FBBC04]" />
        <div className="h-full w-1/4 bg-[#34A853]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-on-surface mb-2 tracking-tight">
            Share Your Feedback
          </h1>
          <p className="text-on-surface-variant max-w-xl mx-auto text-base sm:text-lg">
            Your feedback directly guides GDG Davao in organizing better developer conferences, hands-on workshops, and community events.
          </p>
        </div>

        {event && (
          <Card padding="lg" className="mb-8 relative overflow-hidden">
            <div className="canvas-dots absolute inset-0 opacity-40 pointer-events-none" aria-hidden="true" />
            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <Badge tone="neutral">
                  {toDate(event.startDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Badge>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-on-surface break-words tracking-tight">
                {event.title}
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant break-words">
                📍 {formatEventLocation(event.venue)}
              </p>
              {userName && (
                <p className="mt-3 text-sm font-medium text-primary break-words">
                  Hi {userName.split(' ')[0]}! Thanks for attending.
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Anonymous Feedback Notice when accessing without email token */}
        {!token && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-outline-variant bg-surface p-4 text-left shadow-elevation-0">
            <InformationCircleIcon className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold text-on-surface">Submitting General Feedback</p>
              <p className="text-on-surface-variant mt-0.5">
                You are submitting feedback anonymously. If you are an attendee seeking your Certificate of Participation, please open this form from the personalized feedback link emailed to your registered address.
              </p>
            </div>
          </div>
        )}

        {/* Feedback Form */}
        <Card padding="lg" className="shadow-elevation-1">
          <FormRenderer
            fields={feedbackForm}
            onSubmit={handleFeedbackSubmit}
            submitButtonText={submitting ? "Submitting..." : "Submit Feedback & Unlock Certificate"}
            disabled={submitting}
            className="space-y-6"
          />
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

export default FeedbackPage; 

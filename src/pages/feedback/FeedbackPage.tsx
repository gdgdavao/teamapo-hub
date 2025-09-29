
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import usePageTitle from '../../hooks/usePageTitle';
import useSEO from '../../hooks/useSEO';
import FormRenderer from '../../components/shared/FormRenderer/FormRenderer';
import { EventService } from '../../services/eventService';
import { FeedbackService } from '../../services/feedbackService';
import { Event, FormField } from '../../types';

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
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            Your feedback has been submitted successfully. We appreciate your time and input!
          </p>
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
                  {new Date(event.startDate.toDate()).toLocaleDateString('en-US', {
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
                {new Date(event.startDate.toDate()).toLocaleDateString('en-US', {
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
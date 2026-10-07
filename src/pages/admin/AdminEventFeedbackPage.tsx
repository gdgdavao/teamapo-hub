import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeftIcon,
  StarIcon,
  ChartBarIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  CalendarDaysIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/20/solid';
import DashboardShell from '../../components/shared/DashboardShell';
import FeedbackEmailStatus from '../../components/admin/FeedbackEmailStatus';
import ProgressBar from '../../components/shared/UI/ProgressBar';
import { FeedbackService } from '../../services/feedbackService';
import { EventService } from '../../services/eventService';
import { Feedback, Event } from '../../types';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

type FeedbackFormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

type RatingAggregation = {
  type: 'rating';
  distribution: Record<number, number>;
  total: number;
  average: string;
};

type SelectAggregation = {
  type: 'select';
  counts: Record<string, number>;
  total: number;
  options: string[];
};

type MultiSelectAggregation = {
  type: 'multiselect';
  counts: Record<string, number>;
  total: number;
  options: string[];
};

type CheckboxAggregation = {
  type: 'checkbox';
  yesCount: number;
  noCount: number;
  total: number;
};

type TextAggregation = {
  type: 'text';
  responses: string[];
  total: number;
};

type NumberAggregation = {
  type: 'number';
  average: string;
  min: number;
  max: number;
  total: number;
};

type OtherAggregation = {
  type: 'other';
  responses: Array<string | number | boolean | string[]>;
  total: number;
};

type FieldAggregation =
  | RatingAggregation
  | SelectAggregation
  | MultiSelectAggregation
  | CheckboxAggregation
  | TextAggregation
  | NumberAggregation
  | OtherAggregation;

interface AdminEventFeedbackPageProps {
  embedded?: boolean;
  propEventId?: string;
}

const AdminEventFeedbackPage: React.FC<AdminEventFeedbackPageProps> = ({
  embedded = false,
  propEventId
}) => {
  const { eventId: paramEventId } = useParams<{ eventId: string }>();
  const eventId = propEventId || paramEventId;
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [feedbackFormFields, setFeedbackFormFields] = useState<FeedbackFormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'individual'>('summary');
  const [selectedResponse, setSelectedResponse] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    
    try {
      setLoading(true);
      
      // Fetch event details, feedback, and feedback form in parallel
      const [eventData, feedbackData, feedbackForm] = await Promise.all([
        EventService.getEvent(eventId),
        FeedbackService.getEventFeedback(eventId),
        EventService.getFeedbackForm(eventId)
      ]);
      
      setEvent(eventData);
      setFeedbackList(feedbackData);
      setFeedbackFormFields(feedbackForm.fields || []);
    } catch (error) {
      logger.error('Error fetching feedback data:', error);
      toast.error('Failed to load feedback data');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Callback when feedback emails are sent
  const handleEmailsSent = useCallback(() => {
    // Refresh feedback data in case some people submit immediately
    fetchData();
  }, [fetchData]);

  // Helper function to safely convert Firestore Timestamp or Date to Date object
  const toDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
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
    
    return null;
  };

  // Get the actual rating from feedback - check customResponses first
  const getActualRating = (feedback: Feedback): number => {
    const responses = (feedback as any).customResponses || (feedback as any).responses || {};
    
    // Try to find a rating field in the responses
    const ratingField = feedbackFormFields.find((field) => field.type === 'rating');
    if (ratingField && responses[ratingField.id] !== undefined) {
      return Number(responses[ratingField.id]) || 0;
    }
    
    // Check common rating field names
    const ratingKeys = ['overall_rating', 'overallRating', 'rating', 'event_rating'];
    for (const key of ratingKeys) {
      if (responses[key] !== undefined) {
        return Number(responses[key]) || 0;
      }
    }
    
    // Fallback to the stored overallRating
    return feedback.overallRating || 0;
  };

  const calculateAverageRating = () => {
    if (feedbackList.length === 0) return 0;
    const total = feedbackList.reduce((sum, feedback) => sum + getActualRating(feedback), 0);
    return (total / feedbackList.length).toFixed(1);
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    feedbackList.forEach(feedback => {
      const rating = getActualRating(feedback);
      if (rating >= 1 && rating <= 5) {
        distribution[rating as keyof typeof distribution]++;
      }
    });
    return distribution;
  };

  const getRecommendationRate = () => {
    const recommendCount = feedbackList.filter(feedback => 
      feedback.wouldRecommend === true
    ).length;
    return feedbackList.length > 0 ? Math.round((recommendCount / feedbackList.length) * 100) : 0;
  };

  // Aggregate responses for a specific field (Google Forms style)
  const getFieldAggregation = (field: FeedbackFormField): FieldAggregation => {
    const responses: unknown[] = [];
    
    feedbackList.forEach(feedback => {
      const customResponses = (feedback as any).customResponses || (feedback as any).responses || {};
      const value = customResponses[field.id];
      if (value !== undefined && value !== null && value !== '') {
        responses.push(value);
      }
    });

    // For rating fields, return distribution
    if (field.type === 'rating') {
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      responses.forEach(val => {
        const rating = Number(val);
        if (rating >= 1 && rating <= 5) {
          distribution[rating]++;
        }
      });
      const total = responses.length;
      const average = total > 0
        ? (responses.reduce<number>((sum, value) => sum + Number(value), 0) / total).toFixed(1)
        : '0';
      return { type: 'rating', distribution, total, average };
    }

    // For select, radio - count each option
    if (field.type === 'select' || field.type === 'radio') {
      const counts: Record<string, number> = {};
      (field.options || []).forEach((opt: string) => { counts[opt] = 0; });
      responses.forEach((val) => {
        const optionValue = String(val);
        counts[optionValue] = (counts[optionValue] || 0) + 1;
      });
      return { type: 'select', counts, total: responses.length, options: field.options || [] };
    }

    // For multiselect, checkbox arrays - count each option selection
    if (field.type === 'multiselect') {
      const counts: Record<string, number> = {};
      (field.options || []).forEach((opt: string) => { counts[opt] = 0; });
      responses.forEach((val) => {
        if (Array.isArray(val)) {
          val.forEach((item) => {
            const optionValue = String(item);
            counts[optionValue] = (counts[optionValue] || 0) + 1;
          });
        }
      });
      return { type: 'multiselect', counts, total: responses.length, options: field.options || [] };
    }

    // For checkbox (boolean)
    if (field.type === 'checkbox') {
      const yesCount = responses.filter(v => v === true || v === 'true' || v === 'yes').length;
      const noCount = responses.length - yesCount;
      return { type: 'checkbox', yesCount, noCount, total: responses.length };
    }

    // For text/textarea - return all text responses
    if (field.type === 'text' || field.type === 'textarea') {
      const textResponses = responses.map((value) => String(value));
      return { type: 'text', responses: textResponses, total: textResponses.length };
    }

    // For number fields
    if (field.type === 'number') {
      const nums = responses.map(v => Number(v)).filter(n => !isNaN(n));
      const average = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '0';
      const min = nums.length > 0 ? Math.min(...nums) : 0;
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return { type: 'number', average, min, max, total: nums.length };
    }

    // Default: just return response count
    return { type: 'other', responses: responses as Array<string | number | boolean | string[]>, total: responses.length };
  };

  const formatDate = (timestamp: any) => {
    const date = toDate(timestamp);
    if (!date) return 'N/A';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    if (feedbackList.length === 0) {
      toast.error('No feedback data to export');
      return;
    }

    const headers = [
      'Response ID',
      'Submitted At',
      'User Name',
      'Overall Rating',
      'Would Recommend',
      'Comments',
      'Suggestions'
    ];

    const csvContent = [
      headers.join(','),
      ...feedbackList.map((feedback, index) => [
        index + 1,
        formatDate(feedback.submittedAt),
        `"${(feedback as any).userName || 'Anonymous'}"`,
        feedback.overallRating,
        feedback.wouldRecommend ? 'Yes' : 'No',
        `"${feedback.comments || ''}"`,
        `"${feedback.suggestions || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${event?.title || 'event'}_feedback_responses.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Feedback responses exported successfully');
  };

  if (loading) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-on-surface-variant">Loading feedback responses...</span>
        </div>
      );
    }
    return (
      <DashboardShell title="Event Feedback" subtitle="Loading feedback responses...">
        <div className="flex items-center justify-center h-64">
          <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-on-surface-variant">Loading feedback responses...</span>
        </div>
      </DashboardShell>
    );
  }

  if (!event) {
    const notFoundView = (
      <div className="text-center py-12">
        <p className="text-on-surface-variant">Event not found</p>
        <button
          onClick={() => navigate('/events')}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
        >
          Back to Events
        </button>
      </div>
    );
    if (embedded) return notFoundView;
    return (
      <DashboardShell title="Event Not Found" subtitle="The requested event could not be found">
        {notFoundView}
      </DashboardShell>
    );
  }

  const ratingDistribution = getRatingDistribution();
  const averageRating = calculateAverageRating();
  const recommendationRate = getRecommendationRate();

  const feedbackActions = (
    <div className="flex items-center space-x-3">
      <button
        onClick={exportToCSV}
        className="inline-flex items-center px-3 py-2 border border-outline-variant text-sm leading-4 font-medium rounded-md text-on-surface-variant bg-white hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      >
        <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
        Export CSV
      </button>
      {!embedded && (
        <button
          onClick={() => navigate('/events')}
          className="inline-flex items-center px-3 py-2 border border-outline-variant text-sm leading-4 font-medium rounded-md text-on-surface-variant bg-white hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-2" />
          Back to Events
        </button>
      )}
    </div>
  );

  const feedbackContent = (
    <div className={embedded ? "space-y-6" : ""}>
      {embedded && (
        <div className="flex justify-end pb-2">
          {feedbackActions}
        </div>
      )}
      {/* Event Info Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            {event.imageUrl && (
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div>
              <h2 className="text-xl font-semibold text-on-surface">{event.title}</h2>
              <div className="flex items-center space-x-4 mt-2 text-sm text-on-surface-variant">
                <div className="flex items-center">
                  <CalendarDaysIcon className="h-4 w-4 mr-1" />
                  {formatDate(event.startDate)}
                </div>
                <div className="flex items-center">
                  <UsersIcon className="h-4 w-4 mr-1" />
                  {event.currentAttendees} attendees
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Email Status - Shows email delivery tracking */}
      <FeedbackEmailStatus event={event} onEmailsSent={handleEmailsSent} />

      {feedbackList.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-outline-variant mb-4" />
          <h3 className="text-lg font-medium text-on-surface mb-2">No feedback responses yet</h3>
          <p className="text-on-surface-variant">
            Feedback responses will appear here once attendees start submitting them.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="border-b border-outline-variant">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'summary'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                  }`}
                >
                  <ChartBarIcon className="h-4 w-4 inline mr-2" />
                  Summary
                </button>
                <button
                  onClick={() => setActiveTab('individual')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'individual'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                  }`}
                >
                  <EyeIcon className="h-4 w-4 inline mr-2" />
                  Individual ({feedbackList.length})
                </button>
              </nav>
            </div>

            {activeTab === 'summary' ? (
              <div className="p-6">
                {/* Header Stats Row */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant">
                  <div className="flex items-center space-x-2">
                    <UsersIcon className="h-5 w-5 text-outline-variant" />
                    <span className="text-lg font-medium text-on-surface">{feedbackList.length} responses</span>
                  </div>
                </div>

                {/* Google Forms Style - Field by Field Summary */}
                {feedbackFormFields.length > 0 ? (
                  <div className="space-y-6">
                    {feedbackFormFields.map((field: any) => {
                      const aggregation = getFieldAggregation(field);
                      if (aggregation.total === 0) return null;

                      return (
                        <div key={field.id} className="bg-white border border-outline-variant rounded-lg overflow-hidden">
                          {/* Field Header */}
                          <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-low">
                            <h3 className="text-base font-medium text-on-surface">
                              {field.label}
                              {field.required && <span className="text-error ml-1">*</span>}
                            </h3>
                            <p className="text-sm text-on-surface-variant mt-0.5">
                              {aggregation.total} response{aggregation.total !== 1 ? 's' : ''}
                            </p>
                          </div>

                          {/* Field Content */}
                          <div className="p-5">
                            {/* Rating Field - Horizontal Bar Chart */}
                            {aggregation.type === 'rating' && (
                              <div>
                                <div className="flex items-center mb-4">
                                  <span className="text-3xl font-bold text-on-surface mr-2">{aggregation.average}</span>
                                  <div className="flex items-center">
                                    {[...Array(5)].map((_, i) => (
                                      <StarIconSolid
                                        key={i}
                                        className={`h-5 w-5 ${
                                          i < Math.round(Number(aggregation.average)) ? 'text-warning-amber' : 'text-outline-variant'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="ml-2 text-sm text-on-surface-variant">average</span>
                                </div>
                                <div className="space-y-2">
                                  {[5, 4, 3, 2, 1].map(rating => {
                                    const count = aggregation.distribution[rating] || 0;
                                    const percentage = aggregation.total > 0 ? (count / aggregation.total) * 100 : 0;
                                    return (
                                      <div key={rating} className="flex items-center space-x-3">
                                      <div className="w-6 text-sm text-on-surface-variant text-right">{rating}</div>
                                      <ProgressBar
                                        value={percentage}
                                        size="lg"
                                        rounded="sm"
                                        color="bg-blue-500"
                                        label={`${rating} star responses`}
                                      />
                                        <div className="w-12 text-sm text-on-surface-variant text-right">
                                          {count}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Select/Radio Field - Horizontal Bar Chart */}
                            {aggregation.type === 'select' && (
                              <div className="space-y-2">
                                {(aggregation.options || Object.keys(aggregation.counts)).map((option: string) => {
                                  const count = aggregation.counts[option] || 0;
                                  const percentage = aggregation.total > 0 ? (count / aggregation.total) * 100 : 0;
                                  return (
                                    <div key={option} className="flex items-center space-x-3">
                                      <div className="w-32 text-sm text-on-surface-variant truncate" title={option}>{option}</div>
                                      <ProgressBar
                                        value={percentage}
                                        size="lg"
                                        rounded="sm"
                                        color="bg-green-500"
                                        label={option}
                                      />
                                      <div className="w-20 text-sm text-on-surface-variant text-right">
                                        {count} ({Math.round(percentage)}%)
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Multiselect Field - Horizontal Bar Chart (checkbox style) */}
                            {aggregation.type === 'multiselect' && (
                              <div className="space-y-2">
                                {(aggregation.options || Object.keys(aggregation.counts)).map((option: string) => {
                                  const count = aggregation.counts[option] || 0;
                                  const percentage = aggregation.total > 0 ? (count / aggregation.total) * 100 : 0;
                                  return (
                                    <div key={option} className="flex items-center space-x-3">
                                      <div className="w-32 text-sm text-on-surface-variant truncate" title={option}>{option}</div>
                                      <ProgressBar
                                        value={percentage}
                                        size="lg"
                                        rounded="sm"
                                        color="bg-purple-500"
                                        label={option}
                                      />
                                      <div className="w-20 text-sm text-on-surface-variant text-right">
                                        {count} ({Math.round(percentage)}%)
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Checkbox (Boolean) Field */}
                            {aggregation.type === 'checkbox' && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-3">
                                  <div className="w-20 text-sm text-on-surface-variant">Yes</div>
                                  <ProgressBar
                                    value={aggregation.total > 0 ? (aggregation.yesCount / aggregation.total) * 100 : 0}
                                    size="lg"
                                    rounded="sm"
                                    color="bg-green-500"
                                    label="Yes responses"
                                  />
                                  <div className="w-20 text-sm text-on-surface-variant text-right">
                                    {aggregation.yesCount} ({Math.round(aggregation.total > 0 ? (aggregation.yesCount / aggregation.total) * 100 : 0)}%)
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="w-20 text-sm text-on-surface-variant">No</div>
                                  <ProgressBar
                                    value={aggregation.total > 0 ? (aggregation.noCount / aggregation.total) * 100 : 0}
                                    size="lg"
                                    rounded="sm"
                                    color="bg-red-400"
                                    label="No responses"
                                  />
                                  <div className="w-20 text-sm text-on-surface-variant text-right">
                                    {aggregation.noCount} ({Math.round(aggregation.total > 0 ? (aggregation.noCount / aggregation.total) * 100 : 0)}%)
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Number Field */}
                            {aggregation.type === 'number' && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-surface-container-low rounded">
                                  <p className="text-2xl font-bold text-on-surface">{aggregation.average}</p>
                                  <p className="text-sm text-on-surface-variant">Average</p>
                                </div>
                                <div className="text-center p-3 bg-surface-container-low rounded">
                                  <p className="text-2xl font-bold text-on-surface">{aggregation.min}</p>
                                  <p className="text-sm text-on-surface-variant">Min</p>
                                </div>
                                <div className="text-center p-3 bg-surface-container-low rounded">
                                  <p className="text-2xl font-bold text-on-surface">{aggregation.max}</p>
                                  <p className="text-sm text-on-surface-variant">Max</p>
                                </div>
                              </div>
                            )}

                            {/* Text/Textarea Field - List of responses */}
                            {aggregation.type === 'text' && (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {aggregation.responses.slice(0, 10).map((response: string, idx: number) => (
                                  <div key={idx} className="p-3 bg-surface-container-low rounded-lg text-sm text-on-surface-variant">
                                    {response}
                                  </div>
                                ))}
                                {aggregation.responses.length > 10 && (
                                  <button
                                    onClick={() => setActiveTab('individual')}
                                    className="text-primary hover:text-on-secondary-container text-sm font-medium"
                                  >
                                    View all {aggregation.responses.length} responses →
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Other/Unknown field type */}
                            {aggregation.type === 'other' && (
                              <div className="text-sm text-on-surface-variant">
                                {aggregation.total} response{aggregation.total !== 1 ? 's' : ''} collected
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Fallback when no form fields - show basic stats */
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gradient-to-r from-surface-container-low to-secondary-container rounded-lg p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-primary">Average Rating</p>
                            <p className="text-3xl font-bold text-on-secondary-container">{averageRating}</p>
                          </div>
                          <StarIconSolid className="h-8 w-8 text-warning-amber" />
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-success-container to-success-container rounded-lg p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-success">Would Recommend</p>
                            <p className="text-3xl font-bold text-on-success-container">{recommendationRate}%</p>
                          </div>
                          <ChatBubbleLeftRightIcon className="h-8 w-8 text-success" />
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-surface-container-low to-surface-container-high rounded-lg p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-primary">Total Responses</p>
                            <p className="text-3xl font-bold text-on-primary-container">{feedbackList.length}</p>
                          </div>
                          <UsersIcon className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                    </div>

                    {/* Rating Distribution */}
                    <div className="bg-white border border-outline-variant rounded-lg p-5">
                      <h3 className="text-base font-medium text-on-surface mb-4">Rating Distribution</h3>
                      <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map(rating => {
                          const count = ratingDistribution[rating as keyof typeof ratingDistribution];
                          const percentage = feedbackList.length > 0 ? (count / feedbackList.length) * 100 : 0;
                          return (
                            <div key={rating} className="flex items-center space-x-3">
                              <div className="w-6 text-sm text-on-surface-variant text-right">{rating}</div>
                              <ProgressBar
                                value={percentage}
                                size="lg"
                                rounded="sm"
                                color="bg-blue-500"
                                label={`${rating} star responses`}
                              />
                              <div className="w-12 text-sm text-on-surface-variant text-right">{count}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {feedbackList.map((feedback, index) => (
                  <div
                    key={feedback.id}
                    className={`p-6 hover:bg-surface-container-low cursor-pointer transition-colors ${
                      selectedResponse === index ? 'bg-primary-container ring-1 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedResponse(selectedResponse === index ? null : index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="bg-secondary-container text-on-secondary-container text-sm font-medium px-2.5 py-0.5 rounded-full">
                            Response #{index + 1}
                          </span>
                          <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <StarIconSolid
                                key={i}
                                className={`h-4 w-4 ${
                                  i < getActualRating(feedback)
                                    ? 'text-warning-amber'
                                    : 'text-outline-variant'
                                }`}
                              />
                            ))}
                            <span className="text-sm font-medium text-on-surface ml-1">
                              {getActualRating(feedback)}/5
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-on-surface-variant mb-2">
                          <span className="font-medium">{(feedback as any).userName || (feedback as any).userEmail || 'Anonymous'}</span>
                          <span className="mx-2">•</span>
                          <span>{formatDate(feedback.submittedAt)}</span>
                        </div>

                        {/* Show preview of first comment/response if not expanded */}
                        {selectedResponse !== index && (
                          <div className="mt-2">
                            {(() => {
                              const responses = (feedback as any).customResponses || (feedback as any).responses;
                              if (feedback.comments) {
                                return (
                                  <p className="text-sm text-on-surface-variant line-clamp-2">
                                    💬 {feedback.comments}
                                  </p>
                                );
                              }
                              if (responses) {
                                const firstTextResponse = Object.entries(responses).find(
                                  ([key, value]) => typeof value === 'string' && value.length > 10
                                );
                                if (firstTextResponse) {
                                  return (
                                    <p className="text-sm text-on-surface-variant line-clamp-2">
                                      💬 {String(firstTextResponse[1])}
                                    </p>
                                  );
                                }
                              }
                              return (
                                <p className="text-sm text-on-surface-variant italic">
                                  Click to view detailed responses
                                </p>
                              );
                            })()}
                          </div>
                        )}

                        {/* Expanded view showing all responses based on form fields */}
                        {selectedResponse === index && (
                          <div className="mt-4 space-y-4">
                            {(() => {
                              const responses = (feedback as any).customResponses || (feedback as any).responses || {};
                              
                              // If we have feedback form fields, display based on them
                              if (feedbackFormFields.length > 0) {
                                return (
                                  <div className="space-y-3">
                                    {feedbackFormFields.map((field: any) => {
                                      const value = responses[field.id];
                                      if (value === undefined || value === null || value === '') return null;
                                      
                                      return (
                                        <div key={field.id} className="bg-white p-3 rounded border">
                                          <p className="text-sm font-semibold text-on-surface-variant mb-1">
                                            {field.label}
                                            {field.required && <span className="text-error ml-1">*</span>}
                                          </p>
                                          <div className="text-sm text-on-surface">
                                            {field.type === 'rating' && (
                                              <div className="flex items-center space-x-1">
                                                {[...Array(5)].map((_, i) => (
                                                  <StarIconSolid
                                                    key={i}
                                                    className={`h-4 w-4 ${
                                                      i < Number(value) ? 'text-warning-amber' : 'text-outline-variant'
                                                    }`}
                                                  />
                                                ))}
                                                <span className="ml-2 text-on-surface-variant">({value}/5)</span>
                                              </div>
                                            )}
                                            {field.type === 'checkbox' && (
                                              <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                                                value ? 'bg-success-container text-on-success-container' : 'bg-surface-container text-on-surface'
                                              }`}>
                                                {value ? '✓ Yes' : '✗ No'}
                                              </span>
                                            )}
                                            {field.type === 'multiselect' && Array.isArray(value) && (
                                              <div className="flex flex-wrap gap-1">
                                                {value.map((item: string, idx: number) => (
                                                  <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-secondary-container text-on-secondary-container">
                                                    {item}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                            {!['rating', 'checkbox', 'multiselect'].includes(field.type) && (
                                              <p className="whitespace-pre-wrap">{String(value)}</p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }
                              
                              // Fallback: display all responses if no form fields
                              return (
                                <div className="grid grid-cols-1 gap-3">
                                  {Object.entries(responses).map(([key, value]) => (
                                    <div key={key} className="bg-white p-3 rounded border">
                                      <p className="text-sm font-semibold text-on-surface-variant capitalize mb-1">
                                        {key.replace(/_/g, ' ')}:
                                      </p>
                                      <p className="text-sm text-on-surface whitespace-pre-wrap">
                                        {Array.isArray(value) ? value.join(', ') : String(value)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (embedded) {
    return feedbackContent;
  }

  return (
    <DashboardShell 
      title={`Feedback: ${event.title}`}
      subtitle={`${feedbackList.length} response${feedbackList.length !== 1 ? 's' : ''}`}
      actions={feedbackActions}
    >
      {feedbackContent}
    </DashboardShell>
  );
};

export default AdminEventFeedbackPage;

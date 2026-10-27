import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  StarIcon,
  ChartBarIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  PencilSquareIcon,
  LockClosedIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/20/solid';
import { ProgressBar, Button, Badge, Card, EmptyState } from '../../../../components/UI';
import { FeedbackService } from '../../../../services/feedbackService';
import { EventService } from '../../../../services/eventService';
import { Feedback, Event, FormField } from '../../../../types';
import { logger } from '../../../../utils/logger';
import toast from 'react-hot-toast';
import FormBuilder from '../../components/FormBuilder';
import { toDateSafe } from '../../../../utils/dateUtils';
import { escapeCSVCell, downloadCSV } from '../../../../utils/csvExport';

const STARTER_FEEDBACK_FIELDS: FormField[] = [
  { id: '1', type: 'rating', label: 'Overall Event Rating', required: true, gridSize: 'full' },
  { id: '2', type: 'textarea', label: 'What did you like most about the event?', required: false, gridSize: 'full' },
  { id: '3', type: 'textarea', label: 'Areas for improvement and suggestions', required: false, gridSize: 'full' }
];

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

interface FeedbackTabProps {
  /** Required. The tab renders inside /events/:eventId; see AttendeesTab. */
  eventId: string;
}

const FeedbackTab: React.FC<FeedbackTabProps> = ({ eventId }) => {
  
  const [event, setEvent] = useState<Event | null>(null);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [feedbackFormFields, setFeedbackFormFields] = useState<FeedbackFormField[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'main' | 'questions'>('main');
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
      const fields = (feedbackForm.fields || []) as FormField[];
      setFeedbackFormFields(fields);
      setFormFields(fields);
    } catch (error) {
      logger.error('Error fetching feedback data:', error);
      toast.error('Failed to load feedback data. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const handleSaveFeedbackForm = async () => {
    if (!eventId) return;
    try {
      setIsSavingForm(true);
      await FeedbackService.updateFeedbackForm(eventId, formFields);
      setFeedbackFormFields(formFields);
      toast.success('Feedback form questions saved successfully');
      setActiveView('main');
    } catch (error) {
      logger.error('Error updating feedback form:', error);
      toast.error('Failed to save feedback form. Please try again.');
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleLoadStarterTemplate = () => {
    setFormFields(STARTER_FEEDBACK_FIELDS);
    toast.success('Loaded GDG starter feedback questions');
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toDate = (dateValue: any): Date | null => toDateSafe(dateValue);

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
      let value = customResponses[field.id];
      if (value === undefined && field.type === 'rating') {
        const ratingKeys = ['overall_rating', 'overallRating', 'rating', 'event_rating'];
        for (const key of ratingKeys) {
          if (customResponses[key] !== undefined) {
            value = customResponses[key];
            break;
          }
        }
        if (value === undefined && feedback.overallRating !== undefined) {
          value = feedback.overallRating;
        }
      }
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
      toast.error('No feedback data available to export.');
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
      headers.map((h) => escapeCSVCell(h)).join(','),
      ...feedbackList.map((feedback, index) => [
        escapeCSVCell(index + 1),
        escapeCSVCell(formatDate(feedback.submittedAt)),
        escapeCSVCell((feedback as any).userName || 'Anonymous'),
        escapeCSVCell(feedback.overallRating),
        escapeCSVCell(feedback.wouldRecommend ? 'Yes' : 'No'),
        escapeCSVCell(feedback.comments || ''),
        escapeCSVCell(feedback.suggestions || '')
      ].join(','))
    ].join('\n');

    downloadCSV(csvContent, `${event?.title || 'event'}_feedback_responses.csv`);
    
    toast.success('Feedback responses exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-on-surface-variant">Loading feedback responses...</span>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-on-surface-variant">Event not found</p>
        <Link
          to="/events"
          className="mt-4 inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
        >
          Back to Events
        </Link>
      </div>
    );
  }

  const ratingDistribution = getRatingDistribution();
  const averageRating = calculateAverageRating();
  const recommendationRate = getRecommendationRate();

  const isFormLocked = feedbackList.length > 0;

  const renderQuestionsView = () => {
    return (
      <div className="space-y-6">
        {/* Editor Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <Button
              variant="outlined"
              size="sm"
              icon={<ArrowLeftIcon className="h-4 w-4" />}
              onClick={() => setActiveView('main')}
            >
              Back to Feedback
            </Button>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-on-surface">Form Questions</h3>
              <Badge tone={isFormLocked ? 'neutral' : 'info'}>
                {isFormLocked ? 'Locked' : `${formFields.length} Question${formFields.length !== 1 ? 's' : ''}`}
              </Badge>
            </div>
          </div>

          {!isFormLocked && formFields.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                size="sm"
                icon={<SparklesIcon className="h-4 w-4" />}
                onClick={handleLoadStarterTemplate}
              >
                Reset to Starter Template
              </Button>
            </div>
          )}
        </div>

        {isFormLocked ? (
          <div className="space-y-6">
            <div
              className="rounded-xl border border-warning/40 bg-warning-container/20 p-4 sm:p-5"
              role="status"
            >
              <div className="flex items-start gap-3">
                <LockClosedIcon className="h-5 w-5 shrink-0 text-warning-amber mt-0.5" aria-hidden="true" />
                <div>
                  <h4 className="text-sm font-semibold text-on-warning-container">
                    Feedback Form Locked
                  </h4>
                  <p className="text-sm text-on-warning-container mt-0.5">
                    {feedbackList.length} response{feedbackList.length > 1 ? 's have' : ' has'} already been received.
                    Questions are locked to preserve the consistency and integrity of collected feedback.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-on-surface">Active Feedback Questions</h3>
                <Badge tone="neutral">Read Only</Badge>
              </div>

              {feedbackFormFields.length === 0 ? (
                <p className="text-sm text-on-surface-variant italic py-4">No questions were configured for this form.</p>
              ) : (
                <div className="space-y-3">
                  {feedbackFormFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-start justify-between rounded-lg border border-outline-variant bg-surface-container-low p-3.5 sm:p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-on-surface">{field.label}</p>
                            {field.required && (
                              <span className="text-xs text-error font-semibold">*Required</span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant mt-0.5 capitalize">
                            Type: {field.type} {field.options && field.options.length > 0 ? `(${field.options.join(', ')})` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {formFields.length === 0 && (
              <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 sm:p-8 text-center">
                <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-outline-variant mb-3" />
                <h3 className="text-lg font-semibold text-on-surface mb-1.5">No feedback questions configured yet</h3>
                <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-5">
                  Design custom questions for your attendees, or load the standard GDG template with rating and suggestions.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="filled"
                    icon={<SparklesIcon className="h-4 w-4" />}
                    onClick={handleLoadStarterTemplate}
                  >
                    Load GDG Starter Template
                  </Button>
                </div>
              </div>
            )}

            <FormBuilder
              fields={formFields}
              onChange={setFormFields}
              title="Feedback Questions"
              description=""
              showPreview={true}
            />

            <div className="flex justify-end pt-4 border-t border-outline-variant">
              <Button
                variant="filled"
                loading={isSavingForm}
                onClick={handleSaveFeedbackForm}
              >
                Save Feedback Form
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const feedbackActions = (
    <div className="flex items-center gap-2.5">
      {feedbackList.length > 0 && (
        <Button
          variant="outlined"
          size="sm"
          icon={<DocumentArrowDownIcon className="h-4 w-4" />}
          onClick={exportToCSV}
        >
          Export CSV
        </Button>
      )}
      <Button
        variant={formFields.length === 0 ? "filled" : "outlined"}
        size="sm"
        icon={isFormLocked ? <LockClosedIcon className="h-4 w-4" /> : <PencilSquareIcon className="h-4 w-4" />}
        onClick={() => setActiveView('questions')}
      >
        Form Questions
      </Button>
    </div>
  );

  const feedbackContent = (
    <div className="space-y-6">
      {activeView === 'questions' ? (
        renderQuestionsView()
      ) : (
        <div className="bg-surface rounded-xl border border-outline-variant shadow-elevation-0 overflow-hidden">
          {/* Unified Sub-Tabs & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-outline-variant px-4 sm:px-6">
            <nav className="-mb-px flex flex-wrap" aria-label="Feedback views">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`py-4 px-3 sm:px-5 border-b-2 font-medium text-sm flex items-center gap-2 min-h-[48px] ${
                  activeTab === 'summary'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                }`}
              >
                <ChartBarIcon className="h-4 w-4" aria-hidden="true" />
                <span>Summary</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('individual')}
                className={`py-4 px-3 sm:px-5 border-b-2 font-medium text-sm flex items-center gap-2 min-h-[48px] ${
                  activeTab === 'individual'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                }`}
              >
                <EyeIcon className="h-4 w-4" aria-hidden="true" />
                <span>Individual Responses</span>
                <span className="ml-1 rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant font-semibold">
                  {feedbackList.length}
                </span>
              </button>
            </nav>

            <div className="flex items-center gap-2.5 py-3 sm:py-0">
              {feedbackActions}
            </div>
          </div>

          {activeTab === 'summary' && (
            feedbackList.length === 0 ? (
              <div className="py-8 px-4 sm:px-6">
                <EmptyState
                  icon={<ChatBubbleLeftRightIcon className="h-12 w-12 text-outline-variant" />}
                  title={formFields.length === 0 ? "No feedback questions configured yet" : "No feedback responses yet"}
                  description={
                    formFields.length === 0
                      ? "Design custom questions for attendees to submit feedback after attending your event."
                      : "Feedback responses will appear here once attendees start submitting them."
                  }
                  action={
                    <Button
                      variant={formFields.length === 0 ? "filled" : "outlined"}
                      icon={<PencilSquareIcon className="h-4 w-4" />}
                      onClick={() => setActiveView('questions')}
                    >
                      {formFields.length === 0 ? "Configure Form Questions" : "Edit Form Questions"}
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-6">
                {/* Overview Stat Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                  <Card className="flex items-center justify-between p-4 sm:p-5">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Average Rating</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl sm:text-3xl font-bold text-on-surface">{averageRating}</span>
                        <div className="flex items-center text-warning-amber">
                          {[...Array(5)].map((_, i) => (
                            <StarIconSolid
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.round(Number(averageRating)) ? 'text-warning-amber' : 'text-outline-variant'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-warning-container text-on-warning-container shrink-0">
                      <StarIconSolid className="w-5 h-5 text-warning-amber" />
                    </div>
                  </Card>

                  <Card className="flex items-center justify-between p-4 sm:p-5">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Responses</span>
                      <p className="text-2xl sm:text-3xl font-bold text-on-surface">{feedbackList.length}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-primary-container text-primary shrink-0">
                      <UsersIcon className="w-5 h-5" />
                    </div>
                  </Card>

                  <Card className="flex items-center justify-between p-4 sm:p-5">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Would Recommend</span>
                      <p className="text-2xl sm:text-3xl font-bold text-on-surface">{recommendationRate}%</p>
                    </div>
                    <div className="p-3 rounded-xl bg-success-container text-success shrink-0">
                      <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    </div>
                  </Card>
                </div>

                {/* Google Forms Style - Field by Field Summary */}
                {feedbackFormFields.length > 0 ? (
                  <div className="space-y-5 sm:space-y-6">
                    {feedbackFormFields.map((field: any) => {
                      const aggregation = getFieldAggregation(field);
                      if (aggregation.total === 0) return null;

                      return (
                        <Card key={field.id} className="overflow-hidden !p-0">
                          {/* Field Header */}
                          <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-outline-variant bg-surface-container-low">
                            <h3 className="text-base font-semibold text-on-surface">
                              {field.label}
                              {field.required && <span className="text-error ml-1">*</span>}
                            </h3>
                            <p className="text-sm text-on-surface-variant mt-0.5">
                              {aggregation.total} responses
                            </p>
                          </div>

                          {/* Field Content */}
                          <div className="p-4 sm:p-5">
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
                                <div className="space-y-2.5">
                                  {[5, 4, 3, 2, 1].map(rating => {
                                    const count = aggregation.distribution[rating] || 0;
                                    const percentage = aggregation.total > 0 ? (count / aggregation.total) * 100 : 0;
                                    return (
                                      <div key={rating} className="flex items-center gap-3">
                                        <div className="w-6 text-sm text-on-surface-variant text-right shrink-0">{rating}</div>
                                        <ProgressBar
                                          value={percentage}
                                          size="lg"
                                          rounded="sm"
                                          color="bg-primary"
                                          label={`${rating} star responses`}
                                        />
                                        <div className="w-12 text-sm text-on-surface-variant text-right shrink-0">
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
                              <div className="space-y-2.5">
                                {(aggregation.options || Object.keys(aggregation.counts)).map((option: string) => {
                                  const count = aggregation.counts[option] || 0;
                                  const percentage = aggregation.total > 0 ? (count / aggregation.total) * 100 : 0;
                                  return (
                                    <div key={option} className="flex items-center gap-3">
                                      <div className="w-28 sm:w-36 text-sm text-on-surface-variant truncate shrink-0" title={option}>{option}</div>
                                      <ProgressBar
                                        value={percentage}
                                        size="lg"
                                        rounded="sm"
                                        color="bg-primary"
                                        label={option}
                                      />
                                      <div className="w-16 sm:w-20 text-xs sm:text-sm text-on-surface-variant text-right shrink-0">
                                        {count} ({Math.round(percentage)}%)
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Multiselect Field - Horizontal Bar Chart (checkbox style) */}
                            {aggregation.type === 'multiselect' && (
                              <div className="space-y-2.5">
                                {(aggregation.options || Object.keys(aggregation.counts)).map((option: string) => {
                                  const count = aggregation.counts[option] || 0;
                                  const percentage = aggregation.total > 0 ? (count / aggregation.total) * 100 : 0;
                                  return (
                                    <div key={option} className="flex items-center gap-3">
                                      <div className="w-28 sm:w-36 text-sm text-on-surface-variant truncate shrink-0" title={option}>{option}</div>
                                      <ProgressBar
                                        value={percentage}
                                        size="lg"
                                        rounded="sm"
                                        color="bg-secondary"
                                        label={option}
                                      />
                                      <div className="w-16 sm:w-20 text-xs sm:text-sm text-on-surface-variant text-right shrink-0">
                                        {count} ({Math.round(percentage)}%)
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Checkbox (Boolean) Field */}
                            {aggregation.type === 'checkbox' && (
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 text-sm text-on-surface-variant shrink-0">Yes</div>
                                  <ProgressBar
                                    value={aggregation.total > 0 ? (aggregation.yesCount / aggregation.total) * 100 : 0}
                                    size="lg"
                                    rounded="sm"
                                    color="bg-success"
                                    label="Yes responses"
                                  />
                                  <div className="w-20 text-xs sm:text-sm text-on-surface-variant text-right shrink-0">
                                    {aggregation.yesCount} ({Math.round(aggregation.total > 0 ? (aggregation.yesCount / aggregation.total) * 100 : 0)}%)
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-12 text-sm text-on-surface-variant shrink-0">No</div>
                                  <ProgressBar
                                    value={aggregation.total > 0 ? (aggregation.noCount / aggregation.total) * 100 : 0}
                                    size="lg"
                                    rounded="sm"
                                    color="bg-error"
                                    label="No responses"
                                  />
                                  <div className="w-20 text-xs sm:text-sm text-on-surface-variant text-right shrink-0">
                                    {aggregation.noCount} ({Math.round(aggregation.total > 0 ? (aggregation.noCount / aggregation.total) * 100 : 0)}%)
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Number Field */}
                            {aggregation.type === 'number' && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div className="text-center p-3 sm:p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                                  <p className="text-2xl font-bold text-on-surface">{aggregation.average}</p>
                                  <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">Average</p>
                                </div>
                                <div className="text-center p-3 sm:p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                                  <p className="text-2xl font-bold text-on-surface">{aggregation.min}</p>
                                  <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">Min</p>
                                </div>
                                <div className="text-center p-3 sm:p-4 bg-surface-container-low rounded-xl border border-outline-variant/40">
                                  <p className="text-2xl font-bold text-on-surface">{aggregation.max}</p>
                                  <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">Max</p>
                                </div>
                              </div>
                            )}

                            {/* Text/Textarea Field - List of responses */}
                            {aggregation.type === 'text' && (
                              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                {aggregation.responses.slice(0, 10).map((response: string, idx: number) => (
                                  <div key={idx} className="p-3 bg-surface-container-low rounded-lg text-sm text-on-surface border border-outline-variant/40">
                                    {response}
                                  </div>
                                ))}
                                {aggregation.responses.length > 10 && (
                                  <button
                                    onClick={() => setActiveTab('individual')}
                                    className="text-primary hover:text-primary-hover text-sm font-medium pt-1"
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
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  /* Fallback when no form fields - show basic rating distribution */
                  <div className="space-y-6">
                    <Card className="p-4 sm:p-5">
                      <h3 className="text-base font-semibold text-on-surface mb-4">Rating Distribution</h3>
                      <div className="space-y-2.5">
                        {[5, 4, 3, 2, 1].map(rating => {
                          const count = ratingDistribution[rating as keyof typeof ratingDistribution];
                          const percentage = feedbackList.length > 0 ? (count / feedbackList.length) * 100 : 0;
                          return (
                            <div key={rating} className="flex items-center gap-3">
                              <div className="w-6 text-sm text-on-surface-variant text-right shrink-0">{rating}</div>
                              <ProgressBar
                                value={percentage}
                                size="lg"
                                rounded="sm"
                                color="bg-primary"
                                label={`${rating} star responses`}
                              />
                              <div className="w-12 text-sm text-on-surface-variant text-right shrink-0">{count}</div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )
          )}

          {activeTab === 'individual' && (
            <div className="p-4 sm:p-6">
              {feedbackList.length === 0 ? (
                <EmptyState
                  icon={<EyeIcon className="h-12 w-12 text-outline-variant" />}
                  title="No individual responses yet"
                  description="Responses submitted by attendees will appear here individually once received."
                />
              ) : (
                <div className="space-y-3.5 sm:space-y-4">
                  {feedbackList.map((feedback, index) => {
                    const rating = getActualRating(feedback);
                    const attendeeName = (feedback as any).userName || (feedback as any).userEmail || 'Anonymous Attendee';
                    const isAnonymous = attendeeName.toLowerCase().includes('anonymous');
                    const avatarInitial = attendeeName.trim().charAt(0).toUpperCase() || '?';
                    const isExpanded = selectedResponse === index;
                    const responses = (feedback as any).customResponses || (feedback as any).responses || {};

                    // Find preview comment
                    let previewText: string | null = null;
                    if (feedback.comments) {
                      previewText = feedback.comments;
                    } else if (responses) {
                      const firstTextResponse = Object.entries(responses).find(
                        ([, value]) => typeof value === 'string' && (value as string).trim().length > 5
                      );
                      if (firstTextResponse) {
                        previewText = String(firstTextResponse[1]);
                      }
                    }

                    return (
                      <Card
                        key={feedback.id}
                        className={`transition-[border-color,box-shadow] duration-200 !p-0 overflow-hidden ${
                          isExpanded ? 'ring-2 ring-primary/40 shadow-sm' : 'hover:border-outline'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedResponse(isExpanded ? null : index)}
                          className="w-full text-left p-4 sm:p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 sm:gap-3.5">
                              {/* Attendee Avatar */}
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-primary-container text-primary shrink-0 border border-primary/20">
                                {isAnonymous ? '?' : avatarInitial}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm sm:text-base text-on-surface">
                                    {attendeeName}
                                  </span>
                                  <Badge tone="neutral">
                                    Response #{index + 1}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-0.5">
                                  <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span>{formatDate(feedback.submittedAt)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Rating Pill + Expand Chevron */}
                            <div className="flex items-center gap-2.5 sm:gap-3 self-end sm:self-center">
                              <div className="flex items-center gap-1.5 bg-warning-container/30 border border-warning-container/60 px-3 py-1 rounded-full">
                                <StarIconSolid className="h-4 w-4 text-warning-amber" aria-hidden="true" />
                                <span className="text-sm font-bold text-on-surface">{rating}/5</span>
                              </div>

                              <span className="text-xs font-medium text-primary hidden md:inline">
                                {isExpanded ? 'Hide Details' : 'View Details'}
                              </span>
                              <div className="p-1 rounded-full text-on-surface-variant">
                                {isExpanded ? (
                                  <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Collapsed Snippet */}
                          {!isExpanded && previewText && (
                            <div className="mt-3 text-xs sm:text-sm text-on-surface-variant line-clamp-2 bg-surface-container-low/70 rounded-lg p-2.5 sm:p-3 border border-outline-variant/50 flex items-start gap-2">
                              <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" aria-hidden="true" />
                              <span>{previewText}</span>
                            </div>
                          )}
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5 border-t border-outline-variant/60">
                            {feedbackFormFields.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 pt-3">
                                {feedbackFormFields.map((field: any) => {
                                  let value = responses[field.id];
                                  if (value === undefined && field.type === 'rating') {
                                    value = rating;
                                  }
                                  if (value === undefined || value === null || value === '') return null;

                                  return (
                                    <div
                                      key={field.id}
                                      className="p-3 sm:p-3.5 rounded-lg border border-outline-variant/60 bg-surface-container-low space-y-1.5"
                                    >
                                      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
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
                                            <span className="ml-2 text-xs font-semibold text-on-surface-variant">({value}/5)</span>
                                          </div>
                                        )}
                                        {field.type === 'checkbox' && (
                                          <Badge tone={value ? 'success' : 'neutral'}>
                                            {value ? 'Yes' : 'No'}
                                          </Badge>
                                        )}
                                        {field.type === 'multiselect' && Array.isArray(value) && (
                                          <div className="flex flex-wrap gap-1.5">
                                            {value.map((item: string, idx: number) => (
                                              <Badge key={idx} tone="info">
                                                {item}
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                        {!['rating', 'checkbox', 'multiselect'].includes(field.type) && (
                                          <p className="whitespace-pre-wrap font-medium">{String(value)}</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 pt-3">
                                {Object.entries(responses).map(([key, val]) => (
                                  <div
                                    key={key}
                                    className="p-3 sm:p-3.5 rounded-lg border border-outline-variant/60 bg-surface-container-low space-y-1.5"
                                  >
                                    <p className="text-xs font-semibold text-on-surface-variant capitalize tracking-wider">
                                      {key.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-sm text-on-surface whitespace-pre-wrap font-medium">
                                      {Array.isArray(val) ? val.join(', ') : String(val)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return feedbackContent;
};

export default FeedbackTab;

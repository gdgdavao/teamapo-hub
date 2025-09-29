import React, { useState, useEffect } from 'react';
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
import AdminLayout from '../../components/admin/AdminLayout';
import { FeedbackService } from '../../services/feedbackService';
import { EventService } from '../../services/eventService';
import { Feedback, Event } from '../../types';
import toast from 'react-hot-toast';

const AdminEventFeedbackPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'individual'>('summary');
  const [selectedResponse, setSelectedResponse] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventId) return;
      
      try {
        setLoading(true);
        
        // Fetch event details and feedback in parallel
        const [eventData, feedbackData] = await Promise.all([
          EventService.getEvent(eventId),
          FeedbackService.getEventFeedback(eventId)
        ]);
        
        setEvent(eventData);
        setFeedbackList(feedbackData);
      } catch (error) {
        console.error('Error fetching feedback data:', error);
        toast.error('Failed to load feedback data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  const calculateAverageRating = () => {
    if (feedbackList.length === 0) return 0;
    const total = feedbackList.reduce((sum, feedback) => sum + feedback.overallRating, 0);
    return (total / feedbackList.length).toFixed(1);
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    feedbackList.forEach(feedback => {
      distribution[feedback.overallRating as keyof typeof distribution]++;
    });
    return distribution;
  };

  const getRecommendationRate = () => {
    const recommendCount = feedbackList.filter(feedback => 
      feedback.wouldRecommend === true
    ).length;
    return feedbackList.length > 0 ? Math.round((recommendCount / feedbackList.length) * 100) : 0;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
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
    return (
      <AdminLayout title="Event Feedback" subtitle="Loading feedback responses...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading feedback responses...</span>
        </div>
      </AdminLayout>
    );
  }

  if (!event) {
    return (
      <AdminLayout title="Event Not Found" subtitle="The requested event could not be found">
        <div className="text-center py-12">
          <p className="text-gray-500">Event not found</p>
          <button
            onClick={() => navigate('/events')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Events
          </button>
        </div>
      </AdminLayout>
    );
  }

  const ratingDistribution = getRatingDistribution();
  const averageRating = calculateAverageRating();
  const recommendationRate = getRecommendationRate();

  return (
    <AdminLayout 
      title={`Feedback: ${event.title}`}
      subtitle={`${feedbackList.length} response${feedbackList.length !== 1 ? 's' : ''}`}
      actions={
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => navigate('/events')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ChevronLeftIcon className="h-4 w-4 mr-2" />
            Back to Events
          </button>
        </div>
      }
    >
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
              <h2 className="text-xl font-semibold text-gray-900">{event.title}</h2>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
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

      {feedbackList.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback responses yet</h3>
          <p className="text-gray-500">
            Feedback responses will appear here once attendees start submitting them.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'summary'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ChartBarIcon className="h-4 w-4 inline mr-2" />
                  Summary
                </button>
                <button
                  onClick={() => setActiveTab('individual')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'individual'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <EyeIcon className="h-4 w-4 inline mr-2" />
                  Individual ({feedbackList.length})
                </button>
              </nav>
            </div>

            {activeTab === 'summary' ? (
              <div className="p-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Average Rating</p>
                        <p className="text-3xl font-bold text-blue-900">{averageRating}</p>
                      </div>
                      <div className="flex items-center">
                        <StarIconSolid className="h-8 w-8 text-yellow-400" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">Would Recommend</p>
                        <p className="text-3xl font-bold text-green-900">{recommendationRate}%</p>
                      </div>
                      <div className="flex items-center">
                        <ChatBubbleLeftRightIcon className="h-8 w-8 text-green-500" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600">Total Responses</p>
                        <p className="text-3xl font-bold text-purple-900">{feedbackList.length}</p>
                      </div>
                      <div className="flex items-center">
                        <UsersIcon className="h-8 w-8 text-purple-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rating Distribution */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Rating Distribution</h3>
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map(rating => {
                      const count = ratingDistribution[rating as keyof typeof ratingDistribution];
                      const percentage = feedbackList.length > 0 ? (count / feedbackList.length) * 100 : 0;
                      
                      return (
                        <div key={rating} className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1 w-12">
                            <span className="text-sm font-medium">{rating}</span>
                            <StarIconSolid className="h-4 w-4 text-yellow-400" />
                          </div>
                          <div className="flex-1 bg-gray-200 rounded-full h-4">
                            <div
                              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-16 text-sm text-gray-600 text-right">
                            {count} ({Math.round(percentage)}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Comments Preview */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Comments</h3>
                  <div className="space-y-4">
                    {feedbackList
                      .filter(feedback => feedback.comments)
                      .slice(0, 3)
                      .map((feedback, index) => (
                        <div key={feedback.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <div className="flex items-center space-x-1">
                              {[...Array(5)].map((_, i) => (
                                <StarIconSolid
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < feedback.overallRating
                                      ? 'text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-800">{feedback.comments}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {(feedback as any).userName || 'Anonymous'} • {formatDate(feedback.submittedAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {feedbackList.filter(f => f.comments).length > 3 && (
                    <button
                      onClick={() => setActiveTab('individual')}
                      className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View all comments →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {feedbackList.map((feedback, index) => (
                  <div
                    key={feedback.id}
                    className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedResponse === index ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                    onClick={() => setSelectedResponse(selectedResponse === index ? null : index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            Response #{index + 1}
                          </span>
                          <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <StarIconSolid
                                key={i}
                                className={`h-4 w-4 ${
                                  i < feedback.overallRating
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                            <span className="text-sm font-medium text-gray-900 ml-1">
                              {feedback.overallRating}/5
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">{(feedback as any).userName || 'Anonymous'}</span>
                          <span className="mx-2">•</span>
                          <span>{formatDate(feedback.submittedAt)}</span>
                        </div>

                        {selectedResponse === index && (
                          <div className="mt-4 space-y-4">
                            {feedback.comments && (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Comments:</p>
                                <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                                  {feedback.comments}
                                </p>
                              </div>
                            )}
                            
                            {feedback.suggestions && (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Suggestions:</p>
                                <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                                  {feedback.suggestions}
                                </p>
                              </div>
                            )}

                            {feedback.wouldRecommend !== undefined && (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Would Recommend:</p>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  feedback.wouldRecommend
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {feedback.wouldRecommend ? 'Yes' : 'No'}
                                </span>
                              </div>
                            )}

                            {(feedback as any).customResponses && (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Additional Responses:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {Object.entries((feedback as any).customResponses).map(([key, value]) => (
                                    <div key={key} className="bg-white p-3 rounded border">
                                      <p className="text-xs font-medium text-gray-700 capitalize mb-1">
                                        {key.replace(/_/g, ' ')}:
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        {Array.isArray(value) ? value.join(', ') : String(value)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4">
                        {feedback.wouldRecommend !== undefined && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            feedback.wouldRecommend
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {feedback.wouldRecommend ? '👍' : '👎'}
                          </span>
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
    </AdminLayout>
  );
};

export default AdminEventFeedbackPage;

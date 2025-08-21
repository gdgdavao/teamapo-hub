import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ChartBarIcon, 
  UsersIcon, 
  CurrencyDollarIcon, 
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  EyeIcon,
  DocumentChartBarIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { AnalyticsService } from '../../../services/analyticsService';
import { EventService } from '../../../services/eventService';
import { RegistrationService } from '../../../services/registrationService';
import { Event } from '../../../types';
import { EventStats } from '../../../services/analyticsService';
import AdminLayout from '../AdminLayout';
import LoadingSpinner from '../../shared/UI/LoadingSpinner';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { aiService } from '../../../services/aiService';
import ReactMarkdown from 'react-markdown';
import ConfirmationModal from '../../shared/UI/ConfirmationModal';

interface AnalyticsPageProps {
  isEventSpecific?: boolean;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ isEventSpecific = false }) => {
  const { eventId } = useParams<{ eventId: string }>();
  const { userProfile } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('3m');
  const [selectedMetric, setSelectedMetric] = useState('all');
  const [aiInsights, setAiInsights] = useState<{
    performance: string;
    recommendations: string[];
    trends: string[];
  }>({
    performance: '',
    recommendations: [],
    trends: []
  });
    const [aiLoading, setAiLoading] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);

  // Cache key for persisting AI insights across page navigation
  const INSIGHTS_CACHE_KEY = 'apohub_ai_insights_cache';

  // Load cached AI insights on component mount
  useEffect(() => {
    const cachedInsights = localStorage.getItem(INSIGHTS_CACHE_KEY);
    if (cachedInsights) {
      try {
        const parsedInsights = JSON.parse(cachedInsights);
        setAiInsights(parsedInsights);
      } catch (error) {
        console.warn('Error parsing cached AI insights:', error);
      }
    }
  }, []);

  // Function to save AI insights to cache
  const saveInsightsToCache = (insights: typeof aiInsights) => {
    try {
      localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(insights));
    } catch (error) {
      console.warn('Error saving AI insights to cache:', error);
    }
  };

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);

        if (isEventSpecific && eventId) {
          // Load event-specific analytics
          const [eventData, statsData, registrationsData] = await Promise.all([
            EventService.getEvent(eventId),
            AnalyticsService.getEventStats(eventId),
            RegistrationService.getEventRegistrations(eventId)
          ]);

          setEvent(eventData);
          setStats(statsData);
          setRegistrations(registrationsData);
        } else {
          // Load general analytics (for admin dashboard)
          try {
            const dashboardStats = await AnalyticsService.getDashboardStats();
            // For now, we'll use the dashboard stats to populate the general analytics
            setLoading(false);
          } catch (error) {
            console.error('Error loading dashboard stats:', error);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error loading analytics:', error);
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [eventId, isEventSpecific]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const getGrowthIcon = (value: number) => {
    return value >= 0 ? (
      <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
    ) : (
      <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
    );
  };

  const generateFreshAIInsights = async () => {
    setAiLoading(true);
    setShowCacheModal(false);

    try {
      // Prepare context data for AI
      const contextData = {
        totalEvents: 4,
        totalAttendees: 102,
        totalRevenue: 4250,
        averageRating: 4.2,
        timeRange: selectedTimeRange,
        selectedMetric
      };

      // Generate concise performance summary
      const performancePrompt = `Analyze: ${JSON.stringify(contextData)}

Write 1-2 concise sentences about key performance highlights and opportunities. Keep under 50 words.`;

      // Generate focused recommendations
      const recommendationsPrompt = `Data: ${JSON.stringify(contextData)}

List 3 brief, actionable recommendations (each under 15 words). Focus on high-impact improvements.`;

      // Generate key trends
      const trendsPrompt = `Data: ${JSON.stringify(contextData)}

Identify 3 key trends (each under 15 words). Focus on actionable insights for event organizers.`;

      const [performance, recommendations, trends] = await Promise.all([
        aiService.generateResponse(performancePrompt, undefined, undefined, false),
        aiService.generateResponse(recommendationsPrompt, undefined, undefined, false),
        aiService.generateResponse(trendsPrompt, undefined, undefined, false)
      ]);

      const newInsights = {
        performance: performance || 'Unable to generate insights.',
        recommendations: recommendations ? recommendations.split('\n').filter(item => item.trim()).slice(0, 3) : ['Unable to generate recommendations.'],
        trends: trends ? trends.split('\n').filter(item => item.trim()).slice(0, 3) : ['Unable to identify trends.']
      };

      setAiInsights(newInsights);
      saveInsightsToCache(newInsights);

      toast.success('Fresh AI insights generated successfully!');
    } catch (error) {
      console.error('Error generating AI insights:', error);
      toast.error('Failed to generate AI insights. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const useCachedInsights = async () => {
    setAiLoading(true);
    setShowCacheModal(false);

    try {
      // Load from cache
      const cachedInsights = localStorage.getItem(INSIGHTS_CACHE_KEY);
      if (cachedInsights) {
        const parsedInsights = JSON.parse(cachedInsights);
        setAiInsights(parsedInsights);
        toast.success('Loaded insights from cache!');
      } else {
        // Fallback to fresh generation if cache is empty
        await generateFreshAIInsights();
      }
    } catch (error) {
      console.error('Error loading cached insights:', error);
      toast.error('Failed to load cached insights. Generating fresh ones...');
      await generateFreshAIInsights();
    } finally {
      setAiLoading(false);
    }
  };

  const handleRefreshClick = () => {
    // Check if there's cached data
    const cachedInsights = localStorage.getItem(INSIGHTS_CACHE_KEY);
    if (cachedInsights) {
      // Show confirmation modal
      setShowCacheModal(true);
    } else {
      // No cache, generate fresh insights directly
      generateFreshAIInsights();
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }

  if (isEventSpecific && (!event || !stats)) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Analytics Not Available</h1>
            <p className="text-gray-600 mb-8">Unable to load analytics for this event.</p>
            <Link
              to="/events"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Events
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!isEventSpecific) {
    // General analytics view (admin dashboard)
    return (
      <AdminLayout 
        title="Analytics & Insights" 
        subtitle="Comprehensive event analytics with AI-powered insights and recommendations"
        actions={
          <button
            onClick={handleRefreshClick}
            disabled={aiLoading}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
            <span>{aiLoading ? 'Generating...' : 'Refresh AI Insights'}</span>
          </button>
        }
      >
        {/* Filters */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex space-x-4">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="1m">Last Month</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last Year</option>
            </select>
            
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Metrics</option>
              <option value="revenue">Revenue</option>
              <option value="attendance">Attendance</option>
              <option value="satisfaction">Satisfaction</option>
            </select>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarDaysIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">4</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {getGrowthIcon(12)}
              <span className="ml-2 text-sm text-green-600">+12% from last month</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UsersIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Attendees</p>
                <p className="text-2xl font-bold text-gray-900">102</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {getGrowthIcon(8)}
              <span className="ml-2 text-sm text-green-600">+8% from last month</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(4250)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {getGrowthIcon(15)}
              <span className="ml-2 text-sm text-green-600">+15% from last month</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DocumentChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Rating</p>
                <p className="text-2xl font-bold text-gray-900">4.2</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {getGrowthIcon(5)}
              <span className="ml-2 text-sm text-green-600">+5% from last month</span>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI-Powered Insights</h3>
            <SparklesIcon className="h-5 w-5 text-purple-500" />
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Performance Summary</h4>
              <div className="text-blue-700 prose prose-sm max-w-none">
                {aiInsights.performance ? (
                  <ReactMarkdown>{aiInsights.performance}</ReactMarkdown>
                ) : (
                  'Click "Refresh AI Insights" to generate performance analysis.'
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Recommendations</h4>
                {aiInsights.recommendations.length > 0 ? (
                  <div className="text-green-700 prose prose-sm max-w-none">
                    <ReactMarkdown components={{
                      ul: ({children}) => <ul className="space-y-1 text-sm">{children}</ul>,
                      li: ({children}) => <li className="text-sm">{children}</li>
                    }}>
                      {aiInsights.recommendations.map(rec => `- ${rec}`).join('\n')}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-green-700 text-sm">
                    Click "Refresh AI Insights" to generate recommendations.
                  </p>
                )}
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900 mb-2">Trends</h4>
                {aiInsights.trends.length > 0 ? (
                  <div className="text-purple-700 prose prose-sm max-w-none">
                    <ReactMarkdown components={{
                      ul: ({children}) => <ul className="space-y-1 text-sm">{children}</ul>,
                      li: ({children}) => <li className="text-sm">{children}</li>
                    }}>
                      {aiInsights.trends.map(trend => `- ${trend}`).join('\n')}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-purple-700 text-sm">
                    Click "Refresh AI Insights" to identify trends.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">New registration for React Workshop</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-full">
                <CalendarDaysIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Google I/O Extended event published</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-yellow-100 rounded-full">
                <CurrencyDollarIcon className="h-4 w-4 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Payment received for Node.js Bootcamp</p>
                <p className="text-xs text-gray-500">2 days ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cache Confirmation Modal */}
        <ConfirmationModal
          isOpen={showCacheModal}
          onClose={useCachedInsights}
          onConfirm={generateFreshAIInsights}
          title="Use Cached or Generate Fresh?"
          message="You have cached AI insights from a previous generation. Would you like to generate fresh insights or use the cached ones?"
          confirmText="Generate Fresh"
          cancelText="Use Cached"
          type="info"
          isLoading={aiLoading}
        />
      </AdminLayout>
    );
  }

  // Event-specific analytics view
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link 
              to="/events" 
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Events
            </Link>
          </div>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Analytics</h1>
              <p className="text-xl text-gray-600">{event?.title}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Event Date</p>
              <p className="font-medium text-gray-900">{formatDate(event?.startDate)}</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UsersIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Registrations</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.registrations || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Checked In</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.checkedIn || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.revenue || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DocumentChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Rating</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.averageRating || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">No Shows</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.noShows || 0}</p>
              </div>
              <XCircleIcon className="h-8 w-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Feedback Responses</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.feedbackResponses || 0}</p>
              </div>
              <EyeIcon className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Certificates Issued</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.certificatesIssued || 0}</p>
              </div>
              <DocumentChartBarIcon className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Recent Registrations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Registrations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {registrations.slice(0, 5).map((registration) => (
                  <tr key={registration.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {registration.userDetails?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {registration.userDetails?.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {registration.userDetails?.organization || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        registration.attendanceStatus === 'checked-in' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {registration.attendanceStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(registration.totalAmount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(registration.registrationDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AnalyticsPage;

import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon,
  SparklesIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  DocumentChartBarIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../components/AdminLayout';

interface AnalyticsData {
  overview: {
    totalEvents: number;
    totalAttendees: number;
    averageRating: number;
    conversionRate: number;
    growthRate: number;
  };
  eventPerformance: {
    eventId: string;
    eventTitle: string;
    date: string;
    registrations: number;
    attendees: number;
    rating: number;
    conversionRate: number;
  }[];
  attendeeGrowth: {
    month: string;
    attendees: number;
    newRegistrations: number;
  }[];
  demographicsData: {
    experienceLevel: { label: string; value: number; percentage: number }[];
    interests: { label: string; value: number; percentage: number }[];
    organizations: { label: string; value: number; percentage: number }[];
  };
  aiInsights: {
    summary: string;
    recommendations: string[];
    trends: string[];
    predictions: string[];
  };
}

const AdminAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('3m');
  const [selectedMetric, setSelectedMetric] = useState('all');

  // Load analytics data from API
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // TODO: Implement actual API call
        // const analyticsData = await AnalyticsService.getAnalytics({
        //   timeRange: selectedTimeRange,
        //   metric: selectedMetric
        // });
        // setAnalytics(analyticsData);
        setAnalytics(null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setAnalytics(null);
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedTimeRange, selectedMetric]);

  const generateAIInsights = async () => {
    setGeneratingInsights(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      if (analytics) {
        const newInsights = {
          ...analytics.aiInsights,
          summary: "Updated analysis shows continued strong performance with emerging opportunities in specialized workshops.",
          recommendations: [
            "Launch a premium mentorship program for advanced developers",
            "Create industry-specific workshops (healthcare tech, fintech, etc.)",
            "Develop a certification program to increase perceived value",
            "Implement group discounts to attract corporate teams",
            "Consider evening workshops for working professionals"
          ]
        };
        
        setAnalytics({
          ...analytics,
          aiInsights: newInsights
        });
      }
      setGeneratingInsights(false);
    }, 3000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (loading || !analytics) {
    return (
      <AdminLayout title="Analytics & Insights" subtitle="Loading comprehensive analytics...">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Analytics & Insights" 
      subtitle="Comprehensive event analytics with AI-powered insights and recommendations"
      actions={
        <button
          onClick={generateAIInsights}
          disabled={generatingInsights}
          className="btn-primary flex items-center space-x-2"
        >
          <SparklesIcon className="h-4 w-4" />
          <span>{generatingInsights ? 'Generating Insights...' : 'Refresh AI Insights'}</span>
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
        <div className="dashboard-card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-100">
              <CalendarDaysIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalEvents}</p>
              <p className="text-sm text-success-600 flex items-center">
                <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                {formatPercentage(analytics.overview.growthRate)}
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-success-100">
              <UserGroupIcon className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Attendees</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalAttendees.toLocaleString()}</p>
              <p className="text-sm text-success-600 flex items-center">
                <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                {formatPercentage(analytics.overview.growthRate)}
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-accent-100">
              <CurrencyDollarIcon className="h-6 w-6 text-accent-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.overview.totalRevenue)}</p>
              <p className="text-sm text-success-600 flex items-center">
                <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                +35.2%
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Rating</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.averageRating}</p>
              <p className="text-sm text-success-600 flex items-center">
                <ArrowTrendingUpIcon className="h-3 w-3 mr-1" />
                +0.2
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Revenue Chart */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
            <select className="text-sm border border-gray-300 rounded px-2 py-1">
              <option>Monthly</option>
              <option>Weekly</option>
              <option>Daily</option>
            </select>
          </div>
          
          <div className="space-y-4">
            {analytics.revenueData.map((data, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">{data.month}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(data.revenue)}</p>
                  <p className="text-xs text-gray-500">{data.events} events</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendee Growth */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Attendee Growth</h3>
            <span className="text-sm text-gray-500">Last 4 months</span>
          </div>
          
          <div className="space-y-4">
            {analytics.attendeeGrowth.map((data, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-success-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">{data.month}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{data.attendees} attended</p>
                  <p className="text-xs text-gray-500">{data.newRegistrations} registered</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event Performance Table */}
      <div className="dashboard-card mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Event Performance</h3>
          <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1">
            <DocumentChartBarIcon className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registrations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendees
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conversion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.eventPerformance.map((event) => (
                <tr key={event.eventId}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{event.eventTitle}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.registrations}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.attendees}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      event.conversionRate >= 85 ? 'bg-success-100 text-success-800' :
                      event.conversionRate >= 70 ? 'bg-accent-100 text-accent-800' :
                      'bg-secondary-100 text-secondary-800'
                    }`}>
                      {event.conversionRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.revenue > 0 ? formatCurrency(event.revenue) : 'Free'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-900 mr-2">{event.rating}</span>
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-xs ${
                              star <= event.rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                          >
                            ⭐
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demographics and AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Demographics */}
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Attendee Demographics</h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Experience Level</h4>
              <div className="space-y-2">
                {analytics.demographicsData.experienceLevel.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary-500 h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8">{item.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Areas of Interest</h4>
              <div className="space-y-2">
                {analytics.demographicsData.interests.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-success-500 h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8">{item.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <SparklesIcon className="h-5 w-5 text-purple-500" />
              <span>AI Insights</span>
            </h3>
            {generatingInsights && (
              <div className="flex items-center space-x-2 text-sm text-purple-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                <span>Analyzing...</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
              <p className="text-sm text-gray-600">{analytics.aiInsights.summary}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Recommendations</h4>
              <ul className="space-y-2">
                {analytics.aiInsights.recommendations.slice(0, 3).map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm text-gray-600">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Emerging Trends</h4>
              <ul className="space-y-2">
                {analytics.aiInsights.trends.slice(0, 2).map((trend, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <ArrowTrendingUpIcon className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{trend}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Predictions</h4>
              <ul className="space-y-2">
                {analytics.aiInsights.predictions.slice(0, 2).map((prediction, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm text-gray-600">{prediction}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button className="w-full btn-secondary text-sm flex items-center justify-center space-x-2">
              <EyeIcon className="h-4 w-4" />
              <span>View Detailed Report</span>
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalyticsPage;

import React, { useState, useEffect } from 'react';
import { 
  ShareIcon,
  SparklesIcon,
  PhotoIcon,
  CalendarDaysIcon,
  ClockIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '../../components/admin/AdminLayout';

interface SocialPost {
  id: string;
  eventId?: string;
  eventTitle?: string;
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'multiple';
  content: string;
  imageUrl?: string;
  scheduledFor?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  createdAt: string;
  publishedAt?: string;
  engagement?: {
    likes: number;
    shares: number;
    comments: number;
  };
}

interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  venue: string;
  imageUrl?: string;
  ticketPrice: number;
}

const AdminSocialPage: React.FC = () => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  
  // New post form state
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook']);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<string>('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Load events and posts from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        // TODO: Implement actual API calls
        // const eventsData = await EventService.getAllEvents();
        // const postsData = await SocialMediaService.getAllPosts();
        // setEvents(eventsData);
        // setPosts(postsData);
        setEvents([]);
        setPosts([]);
      } catch (error) {
        console.error('Error fetching social media data:', error);
        setEvents([]);
        setPosts([]);
      }
    };

    fetchData();
  }, []);

  const generateAICaption = async () => {
    if (!selectedEvent) return;
    
    setAiGenerating(true);
    const event = events.find(e => e.id === selectedEvent);
    
    // Simulate AI generation
    setTimeout(() => {
      if (event) {
        const eventDate = new Date(event.startDate).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
        
        const aiCaption = `🚀 Exciting news! Join us for "${event.title}" - an amazing learning opportunity for our tech community!

📅 ${eventDate}
📍 ${event.venue}
${event.ticketPrice > 0 ? `💰 Only ₱${event.ticketPrice}` : '🆓 Free registration'}

${event.description}

Don't miss out on this incredible experience! Register now through the link in our bio.

#GDGDavao #TechEvent #Learning #Community #${event.title.replace(/\s+/g, '')}`;

        setPostContent(aiCaption);
        setPostImage(event.imageUrl || '');
      }
      setAiGenerating(false);
    }, 2000);
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent || selectedPlatforms.length === 0) return;

    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const newPost: SocialPost = {
        id: Date.now().toString(),
        eventId: selectedEvent || undefined,
        eventTitle: selectedEvent ? events.find(e => e.id === selectedEvent)?.title : undefined,
        platform: selectedPlatforms.length === 1 ? selectedPlatforms[0] as any : 'multiple',
        content: postContent,
        imageUrl: postImage || undefined,
        scheduledFor: scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}:00Z` : undefined,
        status: scheduleDate && scheduleTime ? 'scheduled' : 'published',
        createdAt: new Date().toISOString(),
        publishedAt: scheduleDate && scheduleTime ? undefined : new Date().toISOString()
      };

      setPosts(prev => [newPost, ...prev]);
      
      // Reset form
      setSelectedEvent('');
      setSelectedPlatforms([]);
      setPostContent('');
      setPostImage('');
      setScheduleDate('');
      setScheduleTime('');
      
      setLoading(false);
    }, 1000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />;
      case 'scheduled':
        return <ClockIcon className="h-5 w-5 text-accent-500" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-5 w-5 text-secondary-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <div className="w-5 h-5 bg-blue-600 rounded"></div>;
      case 'twitter':
        return <div className="w-5 h-5 bg-sky-500 rounded"></div>;
      case 'linkedin':
        return <div className="w-5 h-5 bg-blue-700 rounded"></div>;
      case 'instagram':
        return <div className="w-5 h-5 bg-pink-500 rounded"></div>;
      default:
        return <ShareIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const headerActions = (
    <button
      onClick={() => setShowNewPostModal(true)}
      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
    >
      <PlusIcon className="w-4 h-4 mr-2" />
      Create Post
    </button>
  );

  return (
    <AdminLayout 
      title="Social Media" 
      subtitle="Create and manage social media posts with AI-powered captions"
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShareIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">{posts.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Published</p>
                <p className="text-2xl font-bold text-gray-900">
                  {posts.filter(p => p.status === 'published').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {posts.filter(p => p.status === 'scheduled').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <SparklesIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">AI Generated</p>
                <p className="text-2xl font-bold text-gray-900">
                  {posts.filter(p => p.eventId).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Posts */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Posts</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <ShareIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No posts yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create your first social media post to get started.
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(post.status)}
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {post.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          {post.platform === 'multiple' ? (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              Multiple platforms
                            </span>
                          ) : (
                            <div className="flex items-center space-x-1">
                              {getPlatformIcon(post.platform)}
                              <span className="text-xs text-gray-600 capitalize">
                                {post.platform}
                              </span>
                            </div>
                          )}
                        </div>

                        {post.eventTitle && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                            {post.eventTitle}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-700 mb-3 line-clamp-3">
                        {post.content}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>
                          Created: {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                        {post.scheduledFor && (
                          <span>
                            Scheduled: {new Date(post.scheduledFor).toLocaleDateString()}
                          </span>
                        )}
                        {post.engagement && (
                          <span>
                            {post.engagement.likes} likes • {post.engagement.shares} shares
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="View Post"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                      <button
                        className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                        title="Duplicate Post"
                      >
                        <DocumentDuplicateIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Create Post Modal */}
        {showNewPostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Create New Post</h2>
                <button
                  onClick={() => setShowNewPostModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Event Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Event (Optional)
                  </label>
                  <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Custom Post (No Event)</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.title} - {new Date(event.startDate).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Caption Generator */}
                {selectedEvent && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-purple-900">AI Caption Generator</h3>
                      <button
                        type="button"
                        onClick={generateAICaption}
                        disabled={aiGenerating}
                        className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        {aiGenerating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="h-4 w-4 mr-2" />
                            Generate Caption
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-purple-700">
                      Let AI create an engaging caption for your selected event
                    </p>
                  </div>
                )}

                {/* Platform Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Platforms
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'facebook', name: 'Facebook', color: 'bg-blue-600' },
                      { id: 'twitter', name: 'Twitter', color: 'bg-sky-500' },
                      { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-700' },
                      { id: 'instagram', name: 'Instagram', color: 'bg-pink-500' }
                    ].map(platform => (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => handlePlatformToggle(platform.id)}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                          selectedPlatforms.includes(platform.id)
                            ? `${platform.color} text-white border-transparent`
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {platform.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Post Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Content
                  </label>
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Write your post content here..."
                    required
                  />
                  <div className="mt-1 text-sm text-gray-500">
                    {postContent.length}/500 characters
                  </div>
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image URL (Optional)
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="url"
                      value={postImage}
                      onChange={(e) => setPostImage(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <PhotoIcon className="h-5 w-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Schedule Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Post (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Leave empty to publish immediately
                  </p>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowNewPostModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !postContent || selectedPlatforms.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        {scheduleDate && scheduleTime ? 'Scheduling...' : 'Publishing...'}
                      </>
                    ) : (
                      scheduleDate && scheduleTime ? 'Schedule Post' : 'Publish Now'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* New Post Modal */}
        {showNewPostModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowNewPostModal(false)}></div>
              </div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Create New Post</h3>
                    <button
                      onClick={() => setShowNewPostModal(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Event Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Link to Event (Optional)
                      </label>
                      <select
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Custom Post (No Event)</option>
                        {events.map(event => (
                          <option key={event.id} value={event.id}>
                            {event.title} - {new Date(event.startDate).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* AI Caption Generator */}
                    {selectedEvent && (
                      <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-purple-900">AI Caption Generator</h3>
                          <button
                            type="button"
                            onClick={generateAICaption}
                            disabled={aiGenerating}
                            className="inline-flex items-center px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
                          >
                            {aiGenerating ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Generating...
                              </>
                            ) : (
                              <>
                                <SparklesIcon className="h-4 w-4 mr-2" />
                                Generate Caption
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-sm text-purple-700">
                          Let AI create an engaging caption for your selected event
                        </p>
                      </div>
                    )}

                    {/* Platform Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Platforms
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { id: 'facebook', name: 'Facebook', color: 'bg-blue-600' },
                          { id: 'twitter', name: 'Twitter', color: 'bg-sky-500' },
                          { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-700' },
                          { id: 'instagram', name: 'Instagram', color: 'bg-pink-500' }
                        ].map(platform => (
                          <button
                            key={platform.id}
                            type="button"
                            onClick={() => handlePlatformToggle(platform.id)}
                            className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                              selectedPlatforms.includes(platform.id)
                                ? `${platform.color} text-white border-transparent`
                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {platform.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Post Content */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Post Content
                      </label>
                      <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Write your post content here..."
                        required
                      />
                      <div className="mt-1 text-sm text-gray-500">
                        {postContent.length}/500 characters
                      </div>
                    </div>

                    {/* Image Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={postImage}
                        onChange={(e) => setPostImage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>

                    {/* Schedule Options */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schedule Post (Optional)
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Leave empty to publish immediately
                      </p>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEvent('');
                          setSelectedPlatforms(['facebook']);
                          setPostContent('');
                          setPostImage('');
                          setScheduleDate('');
                          setScheduleTime('');
                          setShowNewPostModal(false);
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading || !postContent || selectedPlatforms.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                            {scheduleDate ? 'Scheduling...' : 'Publishing...'}
                          </>
                        ) : (
                          scheduleDate ? 'Schedule Post' : 'Publish Now'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Posts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Posts</h3>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View All
            </button>
          </div>
          
          <div className="space-y-4">
            {posts.slice(0, 5).map(post => (
              <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getPlatformIcon(post.platform)}
                    {getStatusIcon(post.status)}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      post.status === 'published' ? 'bg-green-100 text-green-800' :
                      post.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                      post.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {post.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                {post.eventTitle && (
                  <p className="text-xs text-blue-600 font-medium mb-2">
                    📅 {post.eventTitle}
                  </p>
                )}
                
                <p className="text-sm text-gray-800 line-clamp-2 mb-3">
                  {post.content}
                </p>
                
                {post.engagement && (
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>❤️ {post.engagement.likes}</span>
                    <span>🔄 {post.engagement.shares}</span>
                    <span>💬 {post.engagement.comments}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Post Preview */}
        {postContent && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              {postImage && (
                <img 
                  src={postImage} 
                  alt="Post preview" 
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {postContent}
              </p>
              <div className="flex items-center mt-3 pt-3 border-t border-gray-200">
                <div className="flex space-x-2">
                  {selectedPlatforms.map(platform => (
                    <div key={platform} className="flex items-center space-x-1">
                      {getPlatformIcon(platform)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSocialPage;

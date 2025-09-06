import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';

const FeedbackPage: React.FC = () => {
  // Set page title
  usePageTitle();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Event Feedback</h1>
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-600">Feedback page coming soon...</p>
      </div>
    </div>
  );
};

export default FeedbackPage; 
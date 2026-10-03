import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';

const SignUpPage: React.FC = () => {
  // Set page title
  usePageTitle();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">Sign Up</h1>
        <p className="text-gray-600 text-center">Coming soon...</p>
      </div>
    </div>
  );
};

export default SignUpPage; 
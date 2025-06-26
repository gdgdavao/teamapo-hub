import React from 'react';
import { Link } from 'react-router-dom';
import { getAdminUrl } from '../utils/subdomain';

const AdminAccessInfo: React.FC = () => {
  const handleRedirectToAdmin = () => {
    window.location.href = getAdminUrl('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center space-x-1">
            <div className="w-10 h-10 bg-gradient-google rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">APOHUB</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Admin Access Required
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Administrative features are only available via the admin portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Access Admin Portal
            </h3>
            
            <p className="text-sm text-gray-600 mb-6">
              To access admin features, you need to visit the admin subdomain. 
              This helps keep administrative functions separate from public features.
            </p>
            
            <button
              onClick={handleRedirectToAdmin}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 mb-4"
            >
              Go to Admin Portal
            </button>
            
            <Link
              to="/"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              ← Back to main site
            </Link>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  How Admin Access Works
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Admin features are only available at admin.yourdomain.com</li>
                    <li>This keeps admin functions secure and separate</li>
                    <li>Regular users access events and features from the main domain</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAccessInfo;

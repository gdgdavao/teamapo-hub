import React, { useEffect } from 'react';
import { getAdminUrl } from '../../../utils/subdomain';

const AdminRedirect: React.FC = () => {
  useEffect(() => {
    // Redirect to apohub subdomain after a short delay
    const timer = setTimeout(() => {
      window.location.href = getAdminUrl(window.location.pathname);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src="/apohub-title.svg" alt="APOHUB" className="h-10 sm:h-12" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Redirecting to Management Portal
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Admin and organizer features have moved to a dedicated subdomain
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Taking you to the management portal...
            </h3>
            
            <p className="text-sm text-gray-600 mb-6">
              You'll be redirected to the apohub subdomain in a few seconds.
            </p>
            
            <button
              onClick={() => {
                window.location.href = getAdminUrl(window.location.pathname);
              }}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Go Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRedirect;

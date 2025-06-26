import React, { useState } from 'react';
import { getAdminUrl } from '../utils/subdomain';

const DevCredentialsInfo: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isVisible ? (
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Show dev credentials"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Dev Credentials</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3 text-xs">
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <div className="font-medium text-red-800">Admin Access</div>
              <div className="text-red-700">admin@gdgdavao.org</div>
              <div className="text-red-600">password123</div>
              <a 
                href={getAdminUrl('/login')}
                className="text-red-600 hover:text-red-800 underline text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Go to Admin Portal →
              </a>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="font-medium text-blue-800">Organizer</div>
              <div className="text-blue-700">organizer@gdgdavao.org</div>
              <div className="text-blue-600">password123</div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <div className="font-medium text-green-800">Attendee</div>
              <div className="text-green-700">attendee@example.com</div>
              <div className="text-green-600">password123</div>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Development mode only. These credentials are for testing the different user roles.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevCredentialsInfo;

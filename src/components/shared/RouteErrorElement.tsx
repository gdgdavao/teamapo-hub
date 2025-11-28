import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { ExclamationTriangleIcon, HomeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const RouteErrorElement: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage: string;
  let errorStatus: number | undefined;
  let errorDetails: string | undefined;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || 'An error occurred';
    errorDetails = error.data?.message || error.data;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = error.stack;
  } else {
    errorMessage = 'An unexpected error occurred';
  }

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="rounded-full bg-red-100 p-4">
              <ExclamationTriangleIcon className="h-12 w-12 text-red-600" />
            </div>
          </div>

          <div className="text-center mb-6">
            {errorStatus && (
              <div className="text-6xl font-bold text-gray-900 mb-4">
                {errorStatus}
              </div>
            )}
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {errorStatus === 404 ? 'Page Not Found' : 'Oops! Something went wrong'}
            </h1>

            <p className="text-gray-600 mb-2">
              {errorStatus === 404 
                ? "The page you're looking for doesn't exist or has been moved."
                : errorMessage}
            </p>
          </div>

          {/* Error Details (only in development) */}
          {process.env.NODE_ENV === 'development' && errorDetails && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Error Details (Development Only):</h3>
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer font-semibold mb-1">View Details</summary>
                <pre className="whitespace-pre-wrap overflow-auto max-h-60 bg-red-100 p-2 rounded mt-2">
                  {errorDetails}
                </pre>
              </details>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleGoHome}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <HomeIcon className="h-5 w-5 mr-2" />
              Go Home
            </button>
            
            <button
              onClick={handleGoBack}
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Go Back
            </button>

            <button
              onClick={handleReload}
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              Reload
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              If this problem persists, please contact our support team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteErrorElement;

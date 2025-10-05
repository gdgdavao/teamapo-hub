import React, { useEffect, useState } from 'react';

const DomainRedirect: React.FC = () => {
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    // Check if we're on the apohub subdomain
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    if (hostname === 'apohub.gdgdavao.org') {
      // Allow access to login page
      if (pathname === '/login' || pathname === '/auth/login') {
        setRedirecting(false);
        return;
      }
      
      // For all other paths, redirect to main GDG Davao website
      setTimeout(() => {
        // Redirect to the main GDG Davao website
        window.location.href = 'https://gdgdavao.org';
      }, 1500); // 1.5 second delay to show the message
    } else {
      // If not on the apohub subdomain, this shouldn't happen
      setRedirecting(false);
    }
  }, []);

  if (!redirecting) {
    // This should not happen in normal flow since DomainCheck handles login routes
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Redirecting to GDG Davao</h1>
          <p className="text-gray-600 mb-4">
            You're being redirected to the main GDG Davao website at <strong>gdgdavao.org</strong>
          </p>
        </div>
        
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-500">
          If you're not redirected automatically, 
          <a 
            href="https://gdgdavao.org" 
            className="text-blue-600 hover:text-blue-800 underline ml-1"
          >
            click here
          </a>
        </p>
      </div>
    </div>
  );
};

export default DomainRedirect;

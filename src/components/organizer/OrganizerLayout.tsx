import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardNavbar } from '../shared';

interface OrganizerLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

const OrganizerLayout: React.FC<OrganizerLayoutProps> = ({ 
  children, 
  title, 
  subtitle, 
  actions 
}) => {
  const location = useLocation();

  // Auto-generate title if not provided
  const generateTitle = (): string => {
    if (title) return title;
    
    const pathSegments = location.pathname.split('/').filter(Boolean);
    if (pathSegments.length > 1 && pathSegments[1] !== 'dashboard') {
      const pageName = pathSegments[pathSegments.length - 1];
      return pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }
    
    return 'Organizer Dashboard';
  };

  const currentTitle = generateTitle();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Merged Dashboard Navigation (Sidebar + Navbar) */}
      <DashboardNavbar />
      
      {/* Main Content Area - Adjusted for sidebar */}
      <div className="lg:pl-64">
        {/* Page Header - Streamlined */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6">
          {/* Page Title and Actions - Improved */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl lg:text-3xl">
                {currentTitle}
              </h1>
              {subtitle && (
                <p className="mt-1 sm:mt-2 text-sm text-gray-600 max-w-2xl">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <main className="p-3 sm:p-4 lg:p-6 xl:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default OrganizerLayout;

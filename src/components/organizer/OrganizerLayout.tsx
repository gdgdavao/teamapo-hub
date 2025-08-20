import React, { ReactNode } from 'react';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import { DashboardNavbar } from '../shared';

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface OrganizerLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

const OrganizerLayout: React.FC<OrganizerLayoutProps> = ({ 
  children, 
  title, 
  subtitle, 
  breadcrumbs = [], 
  actions 
}) => {
  const location = useLocation();

  // Auto-generate breadcrumbs if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (breadcrumbs.length > 0) return breadcrumbs;
    
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [
      { name: 'Dashboard', href: '/organizer/dashboard' }
    ];

    if (pathSegments.length > 1 && pathSegments[1] !== 'dashboard') {
      const pageName = pathSegments[pathSegments.length - 1];
      const pageNameFormatted = pageName.charAt(0).toUpperCase() + pageName.slice(1);
      crumbs.push({ name: pageNameFormatted });
    }

    return crumbs;
  };

  const currentBreadcrumbs = generateBreadcrumbs();

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
      {/* Dashboard Navigation (handles both admin and organizer roles) */}
      <DashboardNavbar />
      
      {/* Main Content Area */}
      <div className="">
        {/* Page Header - Streamlined */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6">
          {/* Breadcrumbs - Simplified */}
          {currentBreadcrumbs.length > 1 && (
            <nav className="flex mb-3 sm:mb-4" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-1 sm:space-x-2">
                {currentBreadcrumbs.map((crumb, index) => (
                  <li key={index} className="flex items-center">
                    {index > 0 && (
                      <ChevronRightIcon className="flex-shrink-0 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mx-1 sm:mx-2" />
                    )}
                    {index === 0 && (
                      <HomeIcon className="flex-shrink-0 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-1 sm:mr-2" />
                    )}
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {crumb.name}
                      </Link>
                    ) : (
                      <span className="text-xs sm:text-sm font-medium text-gray-900">
                        {crumb.name}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

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

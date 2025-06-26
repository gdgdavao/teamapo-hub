import React, { ReactNode } from 'react';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ 
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
      { name: 'Dashboard', href: '/admin' }
    ];

    if (pathSegments.length > 1) {
      const pageName = pathSegments[1];
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
    if (pathSegments.length > 1) {
      const pageName = pathSegments[1];
      return pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }
    
    return 'Admin Dashboard';
  };

  const currentTitle = generateTitle();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content Area */}
      <div className="">
        {/* Page Header - Streamlined */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumbs - Simplified */}
          {currentBreadcrumbs.length > 1 && (
            <nav className="flex mb-4" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                {currentBreadcrumbs.map((crumb, index) => (
                  <li key={index} className="flex items-center">
                    {index > 0 && (
                      <ChevronRightIcon className="flex-shrink-0 h-4 w-4 text-gray-400 mx-2" />
                    )}
                    {index === 0 && (
                      <HomeIcon className="flex-shrink-0 h-4 w-4 text-gray-400 mr-2" />
                    )}
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {crumb.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-gray-900">
                        {crumb.name}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Page Title and Actions - Improved */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                {currentTitle}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="mt-4 sm:mt-0 sm:ml-6 flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Navigation Overlay (for future mobile menu) */}
      <div className="lg:hidden">
        {/* Mobile menu button and overlay would go here */}
      </div>
    </div>
  );
};

export default AdminLayout;

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ChartBarIcon, 
  CalendarDaysIcon, 
  UserGroupIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  ShareIcon,
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

const AdminNavbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: ChartBarIcon },
    { name: 'Events', href: '/admin/events', icon: CalendarDaysIcon },
    { name: 'Attendees', href: '/admin/attendees', icon: UserGroupIcon },
    { name: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon },
    { name: 'Forms', href: '/admin/forms', icon: DocumentTextIcon },
    { name: 'Certificates', href: '/admin/certificates', icon: AcademicCapIcon },
    { name: 'Social', href: '/admin/social', icon: ShareIcon },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/admin" className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-blue-600">ApoHub</span>
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">
                Admin
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <BellIcon className="w-5 h-5" />
            </button>

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <UserCircleIcon className="w-8 h-8 text-gray-400" />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">Admin User</p>
                  <p className="text-xs text-gray-500">admin@apohub.com</p>
                </div>
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu - You can expand this later */}
      <div className="md:hidden">
        {/* Mobile navigation would go here */}
      </div>
    </nav>
  );
};

export default AdminNavbar;

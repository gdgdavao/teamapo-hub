import React, { useState, useEffect } from 'react';
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
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const AdminNavbar: React.FC = () => {
  const location = useLocation();
  const { currentUser, userProfile, logout, refreshUserProfile } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get user display information with fallbacks
  const getUserDisplayName = () => {
    return userProfile?.displayName || 
           currentUser?.displayName || 
           currentUser?.email?.split('@')[0] || 
           'Admin User';
  };

  const getUserEmail = () => {
    return userProfile?.email || 
           currentUser?.email || 
           'admin@apohub.com';
  };

  // Refresh user profile when component mounts to ensure latest data
  useEffect(() => {
    if (currentUser) {
      refreshUserProfile();
    }
  }, [currentUser, refreshUserProfile]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to reset overflow when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon },
    { name: 'Events', href: '/events', icon: CalendarDaysIcon },
    { name: 'Attendees', href: '/attendees', icon: UserGroupIcon },
    { name: 'Users', href: '/users', icon: UserCircleIcon },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Forms', href: '/forms', icon: DocumentTextIcon },
    { name: 'Certificates', href: '/certificates', icon: AcademicCapIcon },
    { name: 'Social', href: '/social', icon: ShareIcon },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex-shrink-0 flex items-center">
              <span className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">ApoHub</span>
              <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">
                Admin
              </span>
            </Link>
          </div>

          {/* Navigation Links - Hidden on mobile, show hamburger menu instead */}
          <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">
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

          {/* Right side - User menu and mobile menu button */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-110"
            >
              <div className="relative w-6 h-6">
                <Bars3Icon 
                  className={`w-6 h-6 absolute inset-0 transition-all duration-300 transform ${
                    isMobileMenuOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                  }`} 
                />
                <XMarkIcon 
                  className={`w-6 h-6 absolute inset-0 transition-all duration-300 transform ${
                    isMobileMenuOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
                  }`} 
                />
              </div>
            </button>

            {/* Notifications */}
            <button className="hidden sm:block p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <BellIcon className="w-5 h-5" />
            </button>

            {/* User Menu */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="flex items-center space-x-2">
                {(userProfile?.photoURL || currentUser?.photoURL) ? (
                  <img 
                    src={userProfile?.photoURL || currentUser?.photoURL || ''} 
                    alt={getUserDisplayName()}
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover"
                  />
                ) : (
                  <UserCircleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                )}
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
                  <p className="text-xs text-gray-500">{getUserEmail()}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="hidden sm:block p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
        isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Mobile Menu Panel */}
        <div className={`absolute inset-y-0 left-0 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className={`flex items-center transition-all duration-300 ${
              isMobileMenuOpen ? 'scale-105' : 'scale-100'
            }`}>
              <span className="text-lg font-bold text-blue-600">ApoHub</span>
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">
                Admin
              </span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-110 hover:rotate-90"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Navigation Items */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  style={{ 
                    animationDelay: isMobileMenuOpen ? `${index * 50}ms` : '0ms',
                    animation: isMobileMenuOpen ? 'slideInLeft 0.3s ease-out forwards' : 'none'
                  }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Footer */}
          <div className="border-t border-gray-200 p-4 space-y-3">
            <button 
              className="flex items-center space-x-3 w-full px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 transform hover:scale-105"
              style={{ 
                animationDelay: isMobileMenuOpen ? `${navItems.length * 50}ms` : '0ms',
                animation: isMobileMenuOpen ? 'slideInLeft 0.3s ease-out forwards' : 'none'
              }}
            >
              <BellIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Notifications</span>
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-3 w-full px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 transform hover:scale-105"
              style={{ 
                animationDelay: isMobileMenuOpen ? `${(navItems.length + 1) * 50}ms` : '0ms',
                animation: isMobileMenuOpen ? 'slideInLeft 0.3s ease-out forwards' : 'none'
              }}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar;

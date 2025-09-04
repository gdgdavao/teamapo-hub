import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChartBarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import NotificationDropdown from './NotificationDropdown';

const DashboardSidebar: React.FC = () => {
  const location = useLocation();
  const { currentUser, userProfile, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clickedItem, setClickedItem] = useState<string | null>(null);
  
  const isAdmin = userProfile?.role === 'admin';

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleNavItemClick = (itemName: string) => {
    setClickedItem(itemName);
    setTimeout(() => setClickedItem(null), 200);
  };

  const isActive = (href: string) => {
    if (href === '/admin/dashboard' || href === '/organizer/dashboard') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const getUserDisplayName = () => {
    return userProfile?.displayName || userProfile?.email?.split('@')[0] || 'User';
  };

  const navItems = isAdmin ? [
    { name: 'Dashboard', href: '/admin/dashboard', icon: ChartBarIcon },
    { name: 'Events', href: '/events', icon: CalendarDaysIcon },
    { name: 'Attendees', href: '/attendees', icon: UserGroupIcon },
    { name: 'Check-In', href: '/admin/checkin', icon: QrCodeIcon },
    { name: 'Users', href: '/users', icon: UserCircleIcon },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Certificates', href: '/certificates', icon: AcademicCapIcon },
  ] : [
    { name: 'Dashboard', href: '/organizer/dashboard', icon: ChartBarIcon },
    { name: 'Events', href: '/events', icon: CalendarDaysIcon },
    { name: 'Attendees', href: '/attendees', icon: UserGroupIcon },
    { name: 'Check-In', href: '/organizer/checkin', icon: QrCodeIcon },
    { name: 'Certificates', href: '/certificates', icon: AcademicCapIcon },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200 shadow-sm">
          {/* Logo and Brand */}
          <div className="flex h-16 flex-shrink-0 items-center justify-between px-4 border-b border-gray-200">
            <Link
              to={isAdmin ? "/admin/dashboard" : "/organizer/dashboard"}
              className="flex items-center transition-transform duration-200 hover:scale-105"
            >
              <img
                src="/apohub-title2.svg"
                alt="ApoHub"
                className="h-7 w-auto"
              />
            </Link>
            
            {/* Notifications - Moved to top navbar */}
            {currentUser && (
              <div className="flex-shrink-0">
                <NotificationDropdown userId={currentUser.uid} />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isClicked = clickedItem === item.name;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => handleNavItemClick(item.name)}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  } ${isClicked ? 'scale-95' : 'scale-100'}`}
                >
                  <Icon className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    isActive(item.href) ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            {/* User info and logout */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <UserCircleIcon className="h-5 w-5 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {getUserDisplayName()}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {isAdmin ? 'Admin' : 'Organizer'}
                </p>
              </div>
              <div className="ml-3 flex-shrink-0">
                <button
                  onClick={() => {
                    handleNavItemClick('logout');
                    handleLogout();
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  title="Logout"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 relative z-40">
        <div className="flex justify-between items-center h-16 px-4">
          {/* Mobile menu button and Logo */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-label="Toggle mobile menu"
            >
              <div className="relative w-6 h-6">
                <Bars3Icon
                  className={`w-6 h-6 absolute inset-0 transition-all duration-300 transform ${
                    isMobileMenuOpen
                      ? 'rotate-180 scale-0 opacity-0'
                      : 'rotate-0 scale-100 opacity-100'
                  }`}
                />
                <XMarkIcon
                  className={`w-6 h-6 absolute inset-0 transition-all duration-300 transform ${
                    isMobileMenuOpen
                      ? 'rotate-0 scale-100 opacity-100'
                      : 'rotate-180 scale-0 opacity-0'
                  }`}
                />
              </div>
            </button>

            <Link
              to={isAdmin ? "/admin/dashboard" : "/organizer/dashboard"}
              className="flex-shrink-0 flex items-center transition-transform duration-200 hover:scale-105"
            >
              <img
                src="/apohub-title2.svg"
                alt="ApoHub"
                className="h-6 w-auto"
              />
            </Link>
          </div>

          {/* Mobile Right side - User menu and notifications */}
          <div className="flex items-center space-x-3">
            {currentUser && (
              <div className="flex items-center">
                <NotificationDropdown userId={currentUser.uid} />
              </div>
            )}
            
            <button
              onClick={() => {
                handleNavItemClick('logout');
                handleLogout();
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-all duration-300 ${
        isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}>
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Mobile Menu Panel */}
        <div className={`absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl transform transition-all duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          {/* Mobile Menu Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <img
                  src="/apohub-title2.svg"
                  alt="ApoHub"
                  className="h-6 w-auto"
                />
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-all duration-200 transform hover:scale-110"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile User Info */}
            <div className="flex items-center space-x-3">
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <UserCircleIcon className="h-6 w-6 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-900 truncate">{getUserDisplayName()}</p>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">
                  {isAdmin ? 'Admin' : 'Organizer'}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Items */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isClicked = clickedItem === item.name;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => {
                    handleNavItemClick(item.name);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-600 shadow-md border-l-4 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  } ${isClicked ? 'scale-95' : 'scale-100'}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                  {isActive(item.href) && (
                    <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Footer */}
          <div className="border-t border-gray-200 p-4 space-y-3">
            {/* Mobile Notifications */}
            {currentUser && (
              <div className="w-full">
                <NotificationDropdown userId={currentUser.uid} />
              </div>
            )}
            
            {/* Mobile Logout Button */}
            <button
              onClick={() => {
                handleNavItemClick('logout');
                handleLogout();
              }}
              className="flex items-center space-x-4 w-full px-4 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200 transform hover:scale-105 font-medium"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardSidebar;

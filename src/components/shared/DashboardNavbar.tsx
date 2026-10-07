import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAbility } from '@casl/react';
import {
  ChartBarIcon,
  CalendarDaysIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import apohubTitle2 from '@assets/apohub-title2.svg';

const DashboardNavbar: React.FC = () => {
  const location = useLocation();
  const { currentUser, userProfile, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clickedItem, setClickedItem] = useState<string | null>(null);

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  const handleNavItemClick = (itemName: string) => {
    setClickedItem(itemName);
    setTimeout(() => setClickedItem(null), 150);
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

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Which pages this account may reach, rather than what its role is.
  // `read 'User'` is admin-only in the ability table, and is the same
  // discriminator the /users route uses, so the nav and the gate agree.
  const canReadUsers = useAbility().can('read', 'User');

  // Display text, not a permission, so it stays on the raw role.
  const isAdmin = userProfile?.role === 'admin';

  const navItems = canReadUsers ? [
    { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon },
    { name: 'Events', href: '/events', icon: CalendarDaysIcon },
    { name: 'Users', href: '/users', icon: UserCircleIcon },
  ] : [
    { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon },
    { name: 'Events', href: '/events', icon: CalendarDaysIcon },
  ];

  return (
    <>
      {/* Sticky Top Navbar */}
      <header className="sticky top-0 z-40 w-full bg-surface border-b border-outline-variant transition-colors safe-x">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Left: Logo and Desktop Navigation Links */}
            <div className="flex items-center gap-6 lg:gap-8 min-w-0">
              <Link
                to="/dashboard"
                className="flex items-center transition-transform duration-fast ease-quart hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus:ring-primary rounded"
                aria-label="ApoHub Dashboard"
              >
                <img
                  src={apohubTitle2}
                  alt="ApoHub"
                  className="h-7 w-auto"
                />
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isClicked = clickedItem === item.name;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => handleNavItemClick(item.name)}
                      aria-current={active ? 'page' : undefined}
                      className={`md-state-layer group flex items-center px-control-x-sm min-h-control text-sm font-medium rounded-md transition-[color,background-color,transform] duration-short2 ease-emphasized-standard ${
                        active
                          ? "bg-secondary-container text-on-secondary-container font-semibold"
                          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                      } ${isClicked ? "scale-[0.98]" : ""}`}
                    >
                      <Icon className={`mr-2xs h-4 w-4 flex-shrink-0 transition-colors duration-short2 ease-emphasized-standard $
                        active ? "text-secondary" : "text-on-surface-variant group-hover:text-on-surface"
                      }`} aria-hidden="true" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Desktop User Profile & Logout */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="flex items-center gap-3 pl-4 border-l border-outline-variant">
                <div className="flex-shrink-0">
                  {(userProfile?.photoURL || currentUser?.photoURL) ? (
                    <img
                      src={userProfile?.photoURL || currentUser?.photoURL || ''}
                      alt={getUserDisplayName()}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-outline-variant"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-surface-container-high rounded-full flex items-center justify-center">
                      <UserCircleIcon className="h-5 w-5 text-on-surface-variant" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate max-w-[140px] xl:max-w-[200px]">
                    {getUserDisplayName()}
                  </p>
                  <span className="inline-block text-xs font-medium px-xs py-3xs rounded-full bg-secondary-container text-on-secondary-container">
                    {isAdmin ? 'Admin' : 'Organizer'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleNavItemClick('logout');
                    handleLogout();
                  }}
                  className="md-state-layer text-on-surface-variant hover:text-error hover:bg-error-container rounded-md transition-[color,background-color] duration-short2 ease-emphasized-standard min-h-control min-w-control flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title="Logout"
                  aria-label="Logout"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-[color,background-color,transform] duration-base ease-quart active:scale-[0.96] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 min-h-[48px] min-w-[48px] flex items-center justify-center"
                aria-label="Toggle mobile menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <div className="relative w-6 h-6">
                  <Bars3Icon
                    className={`w-6 h-6 absolute inset-0 transition-[transform,opacity] duration-base ease-quart ${
                      isMobileMenuOpen
                        ? 'rotate-90 opacity-0'
                        : 'rotate-0 opacity-100'
                    }`}
                  />
                  <XMarkIcon
                    className={`w-6 h-6 absolute inset-0 transition-[transform,opacity] duration-base ease-quart ${
                      isMobileMenuOpen
                        ? 'rotate-0 opacity-100'
                        : '-rotate-90 opacity-0'
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay & Drawer */}
      <div
        id="mobile-menu"
        className={`lg:hidden fixed inset-0 z-50 transition-[opacity,visibility] ${
          isMobileMenuOpen
            ? 'visible opacity-100 duration-base ease-quart'
            : 'invisible opacity-0 duration-exit ease-in-quart'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 transition-opacity duration-base ease-quart"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Mobile Menu Panel */}
        <div
          className={`absolute inset-y-0 right-0 w-80 max-w-[85vw] bg-white shadow-2xl transition-transform duration-base ease-quart flex flex-col ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Mobile Menu Header */}
          <div className="p-6 border-b border-outline-variant bg-gradient-to-r from-surface-container-low to-primary-container pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
            <div className="flex items-center justify-between mb-4">
              <div
                className={`flex items-center transition-transform duration-base ease-quart ${
                  isMobileMenuOpen ? 'translate-x-0' : 'translate-x-4'
                }`}
              >
                <img
                  src={apohubTitle2}
                  alt="ApoHub"
                  className="h-6 w-auto"
                />
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-outline-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-[color,background-color,transform] duration-fast ease-quart hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 min-h-[48px] min-w-[48px] flex items-center justify-center"
                aria-label="Close mobile menu"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* User Info */}
            <div className="flex items-center space-x-3">
              {(userProfile?.photoURL || currentUser?.photoURL) ? (
                <img
                  src={userProfile?.photoURL || currentUser?.photoURL || ''}
                  alt={getUserDisplayName()}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-outline-variant"
                />
              ) : (
                <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center">
                  <UserCircleIcon className="w-8 h-8 text-outline-variant" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <p className="text-base font-medium text-on-surface truncate">{getUserDisplayName()}</p>
                  <span className="px-2 py-0.5 text-xs font-medium bg-secondary-container text-on-secondary-container rounded-full">
                    {isAdmin ? 'Admin' : 'Organizer'}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant truncate">{getUserEmail()}</p>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Items */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isClicked = clickedItem === item.name;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => {
                    handleNavItemClick(item.name);
                    setIsMobileMenuOpen(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center space-x-4 px-4 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-[color,background-color,transform] duration-fast ease-quart ${
                    active
                      ? 'bg-secondary-container text-on-secondary-container font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  } ${isClicked ? 'scale-[0.98]' : ''} ${isMobileMenuOpen ? 'animate-fade-in motion-reduce:animate-none' : ''}`}
                  style={{
                    animationDelay: isMobileMenuOpen ? `${index * 40}ms` : '0ms'
                  }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                  {active && (
                    <div className="ml-auto w-2 h-2 bg-primary rounded-full" aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Footer */}
          <div className="border-t border-outline-variant p-4 space-y-2 bg-surface-container-low pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <button
              onClick={() => {
                handleNavItemClick('logout');
                handleLogout();
              }}
              className={`flex items-center space-x-4 w-full px-4 py-3 rounded-xl min-h-[48px] text-on-surface-variant hover:text-on-surface hover:bg-white transition-[color,background-color,transform] duration-fast ease-quart ${
                clickedItem === 'logout' ? 'scale-[0.98]' : ''
              } ${isMobileMenuOpen ? 'animate-fade-in motion-reduce:animate-none' : ''}`}
              style={{
                animationDelay: isMobileMenuOpen ? `${(navItems.length + 1) * 40}ms` : '0ms'
              }}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-on-surface-variant" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardNavbar;

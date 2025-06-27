import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Bars3Icon, 
  XMarkIcon, 
  UserCircleIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';

const Header: React.FC = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navLinks = [
    { 
      name: 'Events', 
      href: '/events', 
      icon: CalendarDaysIcon,
      description: 'Discover upcoming events'
    },
  ];

  const authenticatedNavLinks = [
    { 
      name: 'Dashboard', 
      href: '/dashboard',
      icon: ChartBarIcon,
      description: 'Your personal dashboard'
    },
    { 
      name: 'My Events', 
      href: '/my/events',
      icon: CalendarDaysIcon,
      description: 'Events you\'ve joined'
    },
    { 
      name: 'Certificates', 
      href: '/my/certificates',
      icon: AcademicCapIcon,
      description: 'Your earned certificates'
    },
  ];

  const organizerNavLinks = [
    { 
      name: 'Create Event', 
      href: '/organizer/create',
      icon: SparklesIcon,
      description: 'Create new events'
    },
    { 
      name: 'Manage Events', 
      href: '/organizer/events',
      icon: UserGroupIcon,
      description: 'Manage your events'
    },
  ];

  const adminNavLinks = [
    { 
      name: 'Create Event', 
      href: '/admin/create-event',
      icon: SparklesIcon,
      description: 'Create new events (Admin)'
    },
    { 
      name: 'Manage Events', 
      href: '/admin/events',
      icon: UserGroupIcon,
      description: 'Manage all events'
    },
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200 shadow-lg">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <SparklesIcon className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  APOHUB
                </h1>
                <p className="text-xs text-gray-500 -mt-1 font-medium">GDG Davao Events</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {/* Public Links */}
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`group flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive(link.href)
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive(link.href) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <span>{link.name}</span>
                </Link>
              );
            })}

            {/* Authenticated Links */}
            {currentUser && (
              <>
                {authenticatedNavLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.name}
                      to={link.href}
                      className={`group flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive(link.href)
                          ? 'bg-blue-50 text-blue-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive(link.href) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}

                {/* Role-based Links */}
                {userProfile?.role === 'organizer' && (
                  <>
                    {organizerNavLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.name}
                          to={link.href}
                          className={`group flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isActive(link.href)
                              ? 'bg-purple-50 text-purple-700 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive(link.href) ? 'text-purple-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                          <span>{link.name}</span>
                        </Link>
                      );
                    })}
                  </>
                )}

                {userProfile?.role === 'admin' && (
                  <>
                    {adminNavLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.name}
                          to={link.href}
                          className={`group flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isActive(link.href)
                              ? 'bg-red-50 text-red-700 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive(link.href) ? 'text-red-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                          <span>{link.name}</span>
                        </Link>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </nav>

          {/* User Menu (only shown when authenticated) */}
          <div className="flex items-center space-x-4">
            {currentUser && (
              <Menu as="div" className="relative">
                <Menu.Button className="group flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50/80 transition-all duration-200">
                  {userProfile?.photoURL ? (
                    <img
                      src={userProfile.photoURL}
                      alt={userProfile.displayName}
                      className="w-9 h-9 rounded-xl object-cover ring-2 ring-gray-100 group-hover:ring-gray-200 transition-all duration-200"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center">
                      <UserCircleIcon className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {userProfile?.displayName || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {userProfile?.role || 'Attendee'}
                    </p>
                  </div>
                </Menu.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-200"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-150"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 mt-2 w-72 origin-top-right bg-white rounded-2xl shadow-xl ring-1 ring-black/5 focus:outline-none border border-gray-100">
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        {userProfile?.photoURL ? (
                          <img
                            src={userProfile.photoURL}
                            alt={userProfile.displayName}
                            className="w-12 h-12 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center">
                            <UserCircleIcon className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {userProfile?.displayName || 'User'}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {userProfile?.email}
                          </p>
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 mt-1 capitalize">
                            {userProfile?.role || 'Attendee'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="py-2">
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/dashboard/profile"
                            className={`${
                              active ? 'bg-gray-50' : ''
                            } flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150`}
                          >
                            <UserCircleIcon className="w-5 h-5 mr-3 text-gray-400" />
                            <div>
                              <p className="font-medium">Profile Settings</p>
                              <p className="text-xs text-gray-500">Manage your account</p>
                            </div>
                          </Link>
                        )}
                      </Menu.Item>
                      
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/my/events"
                            className={`${
                              active ? 'bg-gray-50' : ''
                            } flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150`}
                          >
                            <CalendarDaysIcon className="w-5 h-5 mr-3 text-gray-400" />
                            <div>
                              <p className="font-medium">My Events</p>
                              <p className="text-xs text-gray-500">Events you've joined</p>
                            </div>
                          </Link>
                        )}
                      </Menu.Item>
                      
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/my/certificates"
                            className={`${
                              active ? 'bg-gray-50' : ''
                            } flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150`}
                          >
                            <AcademicCapIcon className="w-5 h-5 mr-3 text-gray-400" />
                            <div>
                              <p className="font-medium">Certificates</p>
                              <p className="text-xs text-gray-500">Your earned certificates</p>
                            </div>
                          </Link>
                        )}
                      </Menu.Item>
                    </div>
                    
                    <div className="py-2 border-t border-gray-100">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogout}
                            className={`${
                              active ? 'bg-red-50 text-red-700' : 'text-gray-700'
                            } flex items-center w-full px-4 py-3 text-sm hover:bg-red-50 hover:text-red-700 transition-colors duration-150`}
                          >
                            <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
                            <div className="text-left">
                              <p className="font-medium">Sign Out</p>
                              <p className="text-xs text-gray-500">Come back soon!</p>
                            </div>
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-all duration-200"
            >
              {isMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" />
              ) : (
                <Bars3Icon className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <Transition
          show={isMenuOpen}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 -translate-y-2"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 -translate-y-2"
        >
          <div className="lg:hidden">
            <div className="px-2 pt-2 pb-6 space-y-1 bg-white/95 backdrop-blur-md border-t border-gray-100">
              {/* Public Links */}
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={`group flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                      isActive(link.href)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon className={`w-5 h-5 ${isActive(link.href) ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div>
                      <p>{link.name}</p>
                      <p className="text-xs text-gray-500">{link.description}</p>
                    </div>
                  </Link>
                );
              })}

              {/* Authenticated Links */}
              {currentUser && (
                <>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Your Account
                    </p>
                    {authenticatedNavLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.name}
                          to={link.href}
                          className={`group flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                            isActive(link.href)
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <Icon className={`w-5 h-5 ${isActive(link.href) ? 'text-blue-600' : 'text-gray-400'}`} />
                          <div>
                            <p>{link.name}</p>
                            <p className="text-xs text-gray-500">{link.description}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Role-based Tools */}
                  {userProfile?.role === 'organizer' && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Organizer Tools
                      </p>
                      {organizerNavLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                          <Link
                            key={link.name}
                            to={link.href}
                            className={`group flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                              isActive(link.href)
                                ? 'bg-purple-50 text-purple-700'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <Icon className={`w-5 h-5 ${isActive(link.href) ? 'text-purple-600' : 'text-gray-400'}`} />
                            <div>
                              <p>{link.name}</p>
                              <p className="text-xs text-gray-500">{link.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {userProfile?.role === 'admin' && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Admin Tools
                      </p>
                      {adminNavLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                          <Link
                            key={link.name}
                            to={link.href}
                            className={`group flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                              isActive(link.href)
                                ? 'bg-red-50 text-red-700'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <Icon className={`w-5 h-5 ${isActive(link.href) ? 'text-red-600' : 'text-gray-400'}`} />
                            <div>
                              <p>{link.name}</p>
                              <p className="text-xs text-gray-500">{link.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="group flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 transition-all duration-200 w-full"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-500" />
                      <div className="text-left">
                        <p>Sign Out</p>
                        <p className="text-xs text-gray-500">Come back soon!</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Transition>
      </div>
    </header>
  );
};

export default Header;

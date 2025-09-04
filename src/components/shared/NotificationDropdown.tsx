import React, { useState, useEffect, useRef } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  BellIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { NotificationService } from '../../services/notificationService';
import { Notification } from '../../types';

interface NotificationDropdownProps {
  userId: string;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    setIsLoading(true);

    // Subscribe to notifications
    const unsubscribeNotifications = NotificationService.subscribeToNotifications(
      userId,
      (newNotifications) => {
        setNotifications(newNotifications);
        setIsLoading(false);
      },
      20 // limit to 20 notifications
    );

    // Subscribe to unread count
    const unsubscribeUnreadCount = NotificationService.subscribeToUnreadCount(
      userId,
      (count) => {
        setUnreadCount(count);
      }
    );

    return () => {
      unsubscribeNotifications();
      unsubscribeUnreadCount();
    };
  }, [userId]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead(userId);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await NotificationService.deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'registration_confirmation':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'payment_success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'event_reminder':
        return <ClockIcon className="w-5 h-5 text-blue-500" />;
      case 'event_update':
        return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
      case 'certificate_ready':
        return <DocumentTextIcon className="w-5 h-5 text-green-500" />;
      case 'feedback_request':
        return <InformationCircleIcon className="w-5 h-5 text-orange-500" />;
      case 'event_cancelled':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'refund_processed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      // Admin notification types
      case 'admin_pending_attendee':
        return <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />;
      case 'admin_high_pending_count':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'admin_event_created':
        return <CheckCircleIcon className="w-5 h-5 text-blue-500" />;
      case 'admin_check_in':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'admin_payment_verified':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return '';

    const now = new Date();
    const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return time.toLocaleDateString();
  };

    return (
    <Menu as="div" className="relative">
      <Menu.Button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
          unreadCount > 0 
            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
        title="Notifications"
      >
        <div className="relative">
          <BellIcon className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95 translate-x-2"
        enterTo="transform opacity-100 scale-100 translate-x-0"
        leave="transition ease-in duration-150"
        leaveFrom="transform opacity-100 scale-100 translate-x-0"
        leaveTo="transform opacity-0 scale-95 translate-x-2"
      >
        <Menu.Items className="absolute z-50 w-80 origin-top-left rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none"
          style={{ 
            left: '100%',
            top: '0',
            marginLeft: '0.5rem',
            maxHeight: 'calc(100vh - 6rem)',
            overflowY: 'auto'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <BellIcon className="w-8 h-8 mb-2" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`relative px-4 py-3 hover:bg-gray-50 transition-colors duration-150 ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {notification.title}
                          </h4>
                          <div className="flex items-center space-x-2 ml-2">
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNotification(notification.id);
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors duration-150"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Mark as read button for unread notifications */}
                    {!notification.isRead && (
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
                        >
                          <CheckIcon className="w-3 h-3" />
                          <span>Mark as read</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 text-center">
                Showing {notifications.length} most recent notifications
              </p>
            </div>
          )}
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default NotificationDropdown;

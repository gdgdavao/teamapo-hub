import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface UsePageTitleProps {
  title?: string;
  contextTitle?: string;
}

/**
 * Hook to automatically set page titles based on current route and user context
 * This provides a simpler interface than useSEO for just title management
 */
const usePageTitle = ({ title, contextTitle }: UsePageTitleProps = {}) => {
  const location = useLocation();
  const params = useParams();
  const { userProfile } = useAuth();

  useEffect(() => {
    // If explicit title is provided, use it
    if (title) {
      document.title = title;
      return;
    }

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const baseTitle = 'TeamApo Hub';
    
    // Handle different route patterns
    if (pathSegments.length === 0 || pathSegments[0] === 'dashboard') {
      if (userProfile?.role === 'admin') {
        document.title = `Admin Dashboard | ${baseTitle}`;
      } else if (userProfile?.role === 'organizer') {
        document.title = `Organizer Dashboard | ${baseTitle}`;
      } else {
        document.title = `Dashboard | ${baseTitle}`;
      }
      return;
    }

    // Handle auth routes
    if (pathSegments[0] === 'auth') {
      const authPage = pathSegments[1];
      switch (authPage) {
        case 'login':
          document.title = `Sign In | ${baseTitle}`;
          break;
        case 'signup':
          document.title = `Sign Up | ${baseTitle}`;
          break;
        case 'forgot-password':
          document.title = `Reset Password | ${baseTitle}`;
          break;
        default:
          document.title = `Authentication | ${baseTitle}`;
      }
      return;
    }

    // Handle admin routes
    if (pathSegments[0] === 'admin') {
      const adminPage = pathSegments[1];
      switch (adminPage) {
        case 'dashboard':
          document.title = `Admin Dashboard | ${baseTitle}`;
          break;
        case 'users':
          document.title = `User Management | ${baseTitle}`;
          break;
        case 'events':
          if (pathSegments[2] === 'create') {
            document.title = `Create Event | ${baseTitle}`;
          } else if (pathSegments[2] === 'edit' && params.eventId) {
            document.title = `Edit Event | ${baseTitle}`;
          } else if (pathSegments[3] === 'attendees' && params.eventId) {
            document.title = `Event Attendees | ${baseTitle}`;
          } else if (pathSegments[3] === 'analytics' && params.eventId) {
            document.title = `Event Analytics | ${baseTitle}`;
          } else {
            document.title = `Manage Events | ${baseTitle}`;
          }
          break;
        case 'checkin':
          document.title = `Check-in Management | ${baseTitle}`;
          break;
        case 'analytics':
          document.title = `Analytics Dashboard | ${baseTitle}`;
          break;
        default:
          document.title = `Admin Panel | ${baseTitle}`;
      }
      return;
    }

    // Handle organizer routes
    if (pathSegments[0] === 'organizer') {
      const organizerPage = pathSegments[1];
      switch (organizerPage) {
        case 'dashboard':
          document.title = `Organizer Dashboard | ${baseTitle}`;
          break;
        case 'checkin':
          document.title = `Event Check-in | ${baseTitle}`;
          break;
        default:
          document.title = `Organizer Panel | ${baseTitle}`;
      }
      return;
    }

    // Handle shared routes
    switch (pathSegments[0]) {
      case 'events':
        if (pathSegments[1] === 'create') {
          document.title = `Create Event | ${baseTitle}`;
        } else if (pathSegments[1] === 'edit' && params.eventId) {
          document.title = `Edit Event | ${baseTitle}`;
        } else if (pathSegments[2] === 'register' && params.eventId) {
          document.title = `Event Registration | ${baseTitle}`;
        } else if (pathSegments[2] === 'attendees' && params.eventId) {
          document.title = `Event Attendees | ${baseTitle}`;
        } else if (pathSegments[2] === 'analytics' && params.eventId) {
          document.title = `Event Analytics | ${baseTitle}`;
        } else {
          document.title = `Events | ${baseTitle}`;
        }
        break;
      case 'attendees':
        document.title = `Attendees | ${baseTitle}`;
        break;
      case 'analytics':
        document.title = `Analytics | ${baseTitle}`;
        break;
      case 'certificates':
        document.title = `Certificates | ${baseTitle}`;
        break;
      case 'users':
        document.title = `User Management | ${baseTitle}`;
        break;
      case 'payment':
        if (params.registrationId) {
          document.title = `Payment | ${baseTitle}`;
        } else if (pathSegments[1] === 'success') {
          document.title = `Payment Success | ${baseTitle}`;
        } else {
          document.title = `Payment | ${baseTitle}`;
        }
        break;
      case 'feedback':
        if (params.eventId) {
          document.title = `Event Feedback | ${baseTitle}`;
        } else {
          document.title = `Feedback | ${baseTitle}`;
        }
        break;
      case 'verify':
        document.title = `Certificate Verification | ${baseTitle}`;
        break;
      default:
        // Handle login route
        if (pathSegments[0] === 'login') {
          document.title = `Sign In | ${baseTitle}`;
        } else {
          document.title = baseTitle;
        }
    }
  }, [title, contextTitle, location.pathname, params, userProfile?.role]);
};

export default usePageTitle;

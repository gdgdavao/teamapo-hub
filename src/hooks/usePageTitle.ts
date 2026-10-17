import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';

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

  useEffect(() => {
    // If explicit title is provided, use it
    if (title) {
      document.title = title;
      return;
    }

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const baseTitle = 'TeamApo Hub';

    // Home is the root route. It carries no role in its title: the nav and the
    // page frame already differentiate the two scopes, and "Admin Home" vs
    // "Organizer Home" told a user nothing they could not already see.
    if (pathSegments.length === 0) {
      document.title = `Home | ${baseTitle}`;
      return;
    }

    // Handle auth routes
    if (pathSegments[0] === 'auth') {
      const authPage = pathSegments[1];
      switch (authPage) {
        case 'login':
          document.title = `Sign In | ${baseTitle}`;
          break;
        case 'forgot-password':
          document.title = `Reset Password | ${baseTitle}`;
          break;
        default:
          document.title = `Authentication | ${baseTitle}`;
      }
      return;
    }

    // Handle shared routes
    switch (pathSegments[0]) {
      case 'e':
        document.title = `Event Registration | ${baseTitle}`;
        break;
      case 'events':
        if (pathSegments[1] === 'create') {
          document.title = `Create Event | ${baseTitle}`;
        } else if (pathSegments[1] === 'edit' && params.eventId) {
          document.title = `Edit Event | ${baseTitle}`;
        } else if (pathSegments[2] === 'register' && params.eventId) {
          document.title = `Event Registration | ${baseTitle}`;
        } else if (pathSegments[2] === 'attendees' && params.eventId) {
          document.title = `Event Attendees | ${baseTitle}`;
        } else if (pathSegments[2] === 'feedback' && params.eventId) {
          document.title = `Event Feedback | ${baseTitle}`;
        } else if (pathSegments[2] === 'promo-codes' && params.eventId) {
          document.title = `Promo Codes | ${baseTitle}`;
        } else if (pathSegments[2] === 'analytics' && params.eventId) {
          document.title = `Event Analytics | ${baseTitle}`;
        } else {
          document.title = `Events | ${baseTitle}`;
        }
        break;
      case 'attendees':
        document.title = `Attendees | ${baseTitle}`;
        break;
      case 'check-in':
        document.title = `Check-in Management | ${baseTitle}`;
        break;
      // /payments and /emails now forward to the attendees list, so title them
      // for where the organizer is actually going, not the retired screen.
      case 'payments':
      case 'emails':
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
      case 'privacy':
        document.title = `Privacy Policy | ${baseTitle}`;
        break;
      case 'terms-of-service':
      case 'terms':
        document.title = `Terms of Service | ${baseTitle}`;
        break;
      default:
        // Handle login route
        if (pathSegments[0] === 'login') {
          document.title = `Sign In | ${baseTitle}`;
        } else {
          document.title = baseTitle;
        }
    }
  }, [title, contextTitle, location.pathname, params]);
};

export default usePageTitle;

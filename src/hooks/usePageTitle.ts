import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface UsePageTitleProps {
  title?: string;
  contextTitle?: string;
}

const BASE_TITLE = 'TeamApo Hub';

const EVENT_TAB_LABELS: Record<string, string> = {
  overview: 'Event Overview',
  attendees: 'Event Attendees',
  responses: 'Event Responses',
  'check-in': 'Event Check-In',
  'promo-codes': 'Promo Codes',
  certificates: 'Event Certificates',
  feedback: 'Event Feedback',
  settings: 'Event Settings',
  analytics: 'Event Analytics',
  kiosk: 'Check-In Kiosk',
  preview: 'Event Preview',
  register: 'Event Registration',
};

/**
 * Pure helper that resolves a context-aware document `<title>` for any route and optional page context.
 */
export function resolvePageTitle(
  pathname: string,
  { title, contextTitle }: UsePageTitleProps = {}
): string {
  const cleanTitle = title?.trim();
  const cleanContext = contextTitle?.trim();

  if (cleanTitle) {
    const hasBrandSuffix =
      cleanTitle.includes(BASE_TITLE) || cleanTitle.includes('Google Developer Groups');
    if (cleanContext) {
      const stripped = cleanTitle.replace(/\s*\|\s*TeamApo Hub.*$/i, '');
      return `${stripped} · ${cleanContext} | ${BASE_TITLE}`;
    }
    return hasBrandSuffix ? cleanTitle : `${cleanTitle} | ${BASE_TITLE}`;
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  let routeLabel = '';

  if (pathSegments.length === 0) {
    routeLabel = 'Home';
  } else if (pathSegments[0] === 'auth' || (pathSegments[0] === '__' && pathSegments[1] === 'auth')) {
    const authPage = pathSegments[0] === '__' ? pathSegments[2] : pathSegments[1];
    switch (authPage) {
      case 'login':
        routeLabel = 'Sign In';
        break;
      case 'forgot-password':
        routeLabel = 'Reset Password';
        break;
      case 'action':
        routeLabel = 'Account Security';
        break;
      default:
        routeLabel = 'Authentication';
    }
  } else {
    switch (pathSegments[0]) {
      case 'e':
        routeLabel = pathSegments[1] ? 'Event Registration' : 'Page Not Found';
        break;
      case 'events':
        if (pathSegments[1] === 'create') {
          routeLabel = 'Create Event';
        } else if (pathSegments[1] === 'edit') {
          routeLabel = 'Edit Event';
        } else if (pathSegments[1] && pathSegments[2]) {
          routeLabel = EVENT_TAB_LABELS[pathSegments[2]] || 'Event Workspace';
        } else if (pathSegments[1]) {
          routeLabel = 'Event Overview';
        } else {
          routeLabel = 'Events';
        }
        break;
      case 'attendees':
      case 'payments':
      case 'emails':
        routeLabel = 'Attendees';
        break;
      case 'check-in':
        routeLabel = 'Check-in Management';
        break;
      case 'analytics':
        routeLabel = 'Analytics';
        break;
      case 'certificates':
        routeLabel = 'Certificates';
        break;
      case 'users':
        routeLabel = 'User Management';
        break;
      case 'audit-logs':
        routeLabel = 'Audit Logs';
        break;
      case 'payment':
        routeLabel = pathSegments[1] === 'success' ? 'Payment Success' : 'Payment';
        break;
      case 'registration':
        routeLabel = pathSegments[1] === 'success' ? 'Registration Complete' : 'Event Registration';
        break;
      case 'ticket':
        routeLabel = 'Your Ticket';
        break;
      case 'feedback':
        routeLabel = pathSegments[1] ? 'Event Feedback' : 'Feedback';
        break;
      case 'verify':
        routeLabel = 'Certificate Verification';
        break;
      case 'privacy':
        routeLabel = 'Privacy Policy';
        break;
      case 'terms-of-service':
      case 'terms':
        routeLabel = 'Terms of Service';
        break;
      case 'forbidden':
        routeLabel = 'Access Restricted';
        break;
      case 'login':
        routeLabel = 'Sign In';
        break;
      default:
        routeLabel = '';
    }
  }

  if (cleanContext && routeLabel) {
    return `${routeLabel} · ${cleanContext} | ${BASE_TITLE}`;
  }
  if (cleanContext) {
    return `${cleanContext} | ${BASE_TITLE}`;
  }
  if (routeLabel) {
    return `${routeLabel} | ${BASE_TITLE}`;
  }
  return BASE_TITLE;
}

/**
 * Hook to automatically set document `<title>` based on current route and dynamic page context.
 */
const usePageTitle = ({ title, contextTitle }: UsePageTitleProps = {}) => {
  const location = useLocation();

  useEffect(() => {
    document.title = resolvePageTitle(location.pathname, { title, contextTitle });
  }, [title, contextTitle, location.pathname]);
};

export default usePageTitle;

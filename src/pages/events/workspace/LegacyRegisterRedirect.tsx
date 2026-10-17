import React from 'react';
import { useParams, Navigate } from 'react-router-dom';

/**
 * Legacy URL forwarder for public registration links.
 *
 * Old links like `/events/:eventId/register` are upgraded seamlessly to
 * `/e/:eventId` so that attendees are never in the organizer `/events/...`
 * route cluster. Truncating the URL will now lead to `/e` (404) rather than
 * diverting to the organizer `/events` dashboard or `/auth/login`.
 */
const LegacyRegisterRedirect: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  if (!eventId) {
    return <Navigate to="/e" replace />;
  }

  return <Navigate to={`/e/${eventId}`} replace />;
};

export default LegacyRegisterRedirect;

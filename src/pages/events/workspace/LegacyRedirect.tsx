import React, { useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { InformationCircleIcon } from '@heroicons/react/20/solid';
import toast from 'react-hot-toast';

interface LegacyRedirectProps {
  targetTab: 'overview' | 'attendees' | 'check-in' | 'certificates';
  label: string;
}

const LegacyRedirect: React.FC<LegacyRedirectProps> = ({ targetTab, label }) => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');

  useEffect(() => {
    if (!eventId) {
      toast(`Please select an event to manage ${label}.`, {
        icon: <InformationCircleIcon className="h-5 w-5 text-primary" aria-hidden="true" />,
        id: `select-event-${targetTab}`, // prevents duplicate toasts
      });
    }
  }, [eventId, label, targetTab]);

  if (eventId) {
    return <Navigate to={`/events/${eventId}/${targetTab}`} replace />;
  }

  return <Navigate to="/events" replace />;
};

export default LegacyRedirect;

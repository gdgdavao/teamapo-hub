import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';

interface LegacyTicketRedirectProps {
  mode?: 'free';
}

/**
 * Legacy URL forwarder for ticket/pass links.
 * Upgrades `/payment/success` and `/registration/success` to canonical `/ticket`
 * while strictly preserving all search parameters (reg, token, etc.) and navigation state.
 */
const LegacyTicketRedirect: React.FC<LegacyTicketRedirectProps> = ({ mode }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  if (mode && !searchParams.has('mode')) {
    searchParams.set('mode', mode);
  }

  const queryString = searchParams.toString();
  const destination = `/ticket${queryString ? `?${queryString}` : ''}`;

  return <Navigate to={destination} replace state={location.state} />;
};

export default LegacyTicketRedirect;

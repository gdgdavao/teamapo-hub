import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const OrganizerCheckInPage: React.FC = () => {
  const { userProfile } = useAuth();
  
  // Redirect organizers to the admin check-in page since they have access
  if (userProfile?.role === 'organizer') {
    return <Navigate to="/admin/checkin" replace />;
  }
  
  // If somehow an admin reaches this page, redirect to admin check-in
  if (userProfile?.role === 'admin') {
    return <Navigate to="/admin/checkin" replace />;
  }
  
  // Fallback - should not happen due to route protection
  return <Navigate to="/dashboard" replace />;
};

export default OrganizerCheckInPage;

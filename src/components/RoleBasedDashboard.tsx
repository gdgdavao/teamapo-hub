import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './UI/LoadingSpinner';

const RoleBasedDashboard: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!currentUser || !userProfile) {
    return <Navigate to="/auth/login" replace />;
  }

  // Redirect based on role
  if (userProfile.role === 'organizer') {
    return <Navigate to="/organizer" replace />;
  }

  // Default to admin dashboard
  return <Navigate to="/dashboard" replace />;
};

export default RoleBasedDashboard; 
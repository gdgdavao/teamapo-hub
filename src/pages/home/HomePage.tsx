import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../../components/UI';
import PlatformHome from './platform/PlatformHome';

/**
 * Under the communal event model, all events belong to the community.
 * Both administrators and organizers share the platform overview.
 */
const HomePage: React.FC = () => {
  const { userProfile, loading } = useAuth();

  if (loading || !userProfile) {
    return <LoadingSpinner fullScreen />;
  }

  return <PlatformHome />;
};

export default HomePage;
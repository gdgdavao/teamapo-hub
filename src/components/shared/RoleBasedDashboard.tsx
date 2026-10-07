import React from 'react';
import { Can } from '@casl/react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './UI/LoadingSpinner';
import AdminDashboardPage from '../../pages/admin/AdminDashboardPage';
import OrganizerDashboardPage from '../../pages/organizer/OrganizerDashboardPage';

/**
 * Chooses the dashboard by permission rather than by role.
 *
 * This read `userProfile.role === 'organizer' ? <Organizer/> : <Admin/>`, so any
 * value that was not literally 'organizer' rendered the ADMIN dashboard: an
 * unrecognised role, a corrupt document, or a future third role added by a
 * migration. AuthContext now rejects unknown roles before they reach here, and
 * the fallback direction is the other way round regardless.
 *
 * `read 'User'` is admin-only in the ability table - an organizer holds no User
 * rules at all - which makes it the same discriminator the /users route uses.
 */
const RoleBasedDashboard: React.FC = () => {
  const { userProfile, loading } = useAuth();

  if (loading || !userProfile) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Can do="read" on="User">
      {({ isAllowed }) =>
        isAllowed ? <AdminDashboardPage /> : <OrganizerDashboardPage />
      }
    </Can>
  );
};

export default RoleBasedDashboard;
import React from 'react';
import { Can } from '@casl/react';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../../components/UI';
import PlatformHome from './platform/PlatformHome';
import ScopedHome from './scoped/ScopedHome';

/**
 * Chooses Home's scope by permission, not by role.
 *
 * This used to read `userProfile.role === 'organizer' ? <Scoped/> : <Platform/>`,
 * so any value that was not literally 'organizer' rendered the platform-wide
 * view: an unrecognised role, a corrupt document, or a future third role added
 * by a migration. AuthContext now rejects unknown roles before they reach here,
 * and the fallback direction is the other way round regardless.
 *
 * `read 'User'` is admin-only in the ability table - an organizer holds no User
 * rules at all - which makes it the same discriminator the /users route uses.
 *
 * The two children are named for what they read, not who they are for, because
 * that is the property that actually differs and the one firestore.rules
 * enforces: PlatformHome runs unscoped reads over every event, registration and
 * certificate; ScopedHome runs owner-scoped reads only.
 */
const HomePage: React.FC = () => {
  const { userProfile, loading } = useAuth();

  if (loading || !userProfile) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Can do="read" on="User">
      {({ isAllowed }) => (isAllowed ? <PlatformHome /> : <ScopedHome />)}
    </Can>
  );
};

export default HomePage;
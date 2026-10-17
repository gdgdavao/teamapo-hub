import React, { createContext, useContext, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppNavbar from './AppNavbar';
import SkipLink from './SkipLink';

interface PersistentLayoutContextValue {
  hasPersistentLayout: boolean;
}

const PersistentLayoutContext = createContext<PersistentLayoutContextValue>({
  hasPersistentLayout: false,
});

export const usePersistentLayout = (): boolean =>
  useContext(PersistentLayoutContext).hasPersistentLayout;

/**
 * Persistent application frame for authenticated routes.
 *
 * AppNavbar and SkipLink stay mounted continuously across route transitions,
 * eliminating harsh viewport flickers and layout tear-down. Only the child
 * content inside <Outlet /> transitions smoothly.
 */
const AppLayout: React.FC = () => {
  const { pathname } = useLocation();

  // Reset scroll cleanly to the top on page navigation
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  // Keep internal workspace tab switches (/events/:id/:tab) from re-triggering full-view transitions
  const routeContentKey = (() => {
    const workspaceMatch = pathname.match(/^(\/events\/[^/]+)(?:\/[^/]+)?$/);
    if (workspaceMatch && workspaceMatch[1] !== '/events/create' && workspaceMatch[1] !== '/events/edit') {
      return workspaceMatch[1];
    }
    return pathname;
  })();

  return (
    <PersistentLayoutContext.Provider value={{ hasPersistentLayout: true }}>
      <div className="min-h-dvh bg-surface">
        <SkipLink />
        <AppNavbar />
        <div key={routeContentKey} className="route-view motion-reduce:animate-none">
          <Outlet />
        </div>
      </div>
    </PersistentLayoutContext.Provider>
  );
};

export default AppLayout;

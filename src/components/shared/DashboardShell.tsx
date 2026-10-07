import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardNavbar from '../shared/DashboardNavbar';
import SkipLink from '../shared/SkipLink';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Single shell for both roles.
 *
 * AdminLayout and OrganizerLayout were 8-line clones that differed only in a
 * title fallback, so every page had to guess which one to import. Those shims
 * are gone, along with the three `isAdmin ? AdminLayout : OrganizerLayout`
 * selections that only appeared to choose between them. Import this directly.
 */
const DashboardShell: React.FC<DashboardShellProps> = ({ children, title, subtitle, actions }) => {
  const location = useLocation();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  const generateTitle = (): string => {
    if (title) return title;

    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length > 0 && segments[0] !== 'dashboard') {
      const pageName = segments[segments.length - 1];
      if (pageName && !pageName.startsWith(':')) {
        return pageName.charAt(0).toUpperCase() + pageName.slice(1).replace(/-/g, ' ');
      }
    }

    return isAdmin ? 'Admin Dashboard' : 'Organizer Dashboard';
  };

  return (
    <div className="min-h-dvh bg-surface">
      <SkipLink />
      <DashboardNavbar />

      <div className="bg-surface border-b border-outline-variant">
        {/*
          Horizontal gutters: px-4 / sm:px-6 / lg:px-8, matched exactly by
          <main> below so the page title and the content under it share one
          left edge. The audit confirmed these already agreed; leave them alone.

          Vertical rhythm: this used to be `py-4 sm:py-6` while <main> was a
          flat `py-6`. The title-to-content gap was therefore 16+24 = 40px on a
          phone and 24+24 = 48px from sm up, and neither number was a token -
          both were the accidental sum of two independent paddings. One value
          on both sides makes the gap a single, reviewable 24px at every width.
        */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-md">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
            <div className="min-w-0 flex-1">
              {/* Keyed on pathname so the crossfade replays per navigation. It
                  signals the view swapped without making anyone wait on it. */}
              <div key={location.pathname} className="route-view motion-reduce:animate-none">
                <h1 className="text-2xl font-bold text-on-surface sm:text-3xl">{generateTitle()}</h1>
                {subtitle && (
                  <p className="mt-3xs text-sm text-on-surface-variant max-w-[70ch]">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && <div className="flex-shrink-0">{actions}</div>}
          </div>
        </div>
      </div>

{/*
        min-h-page, not min-h-screen: 100vh is the TALLEST iOS viewport (the one
        you get with the browser toolbar collapsed), so min-h-screen pushed the
        bottom of every page past the visible area whenever the toolbar was
        showing. The class carries its own `100vh` then `100dvh` declaration
        pair in src/index.css, because two Tailwind height classes on one
        element resolve by stylesheet order rather than class order - which is
        not something to rely on for a viewport bug.
      */}
      <main
        id="main-content"
        className="max-w-7xl mx-auto min-h-page px-4 sm:px-6 lg:px-8 py-md"
      >
        {children}
      </main>
    </div>
  );
};

export default DashboardShell;
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AbilityContextProvider from './auth/AbilityProvider';
import RequireAbility, { RequireAnonymous } from './auth/RequireAbility';
import ErrorBoundary from './components/shared/ErrorBoundary';
import RoleBasedDashboard from './components/shared/RoleBasedDashboard';
import usePageTitle from './hooks/usePageTitle';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Workspace Pages
import ManageEventsPage from './pages/admin/AdminManageEventsPage';
import CreateEventPage from './pages/admin/AdminCreateEventPage';
import EventWorkspacePage from './pages/admin/EventWorkspacePage';
import LegacyRedirect from './pages/admin/LegacyRedirect';
import AdminUsersPage from './pages/admin/AdminUsersPage';

// Public Pages
import EventRegistrationPage from './pages/public/EventRegistrationPage';
import PaymentPage from './pages/payment/PaymentPage';
import PaymentSuccessPage from './pages/payment/PaymentSuccessPage';
import FeedbackPage from './pages/feedback/FeedbackPage';
import CertificateVerificationPage from './pages/verification/CertificateVerificationPage';
import NotFoundPage from './pages/error/NotFoundPage';
import ForbiddenPage from './pages/error/ForbiddenPage';

// Vercel Analytics
import { Analytics } from "@vercel/analytics/react"

const AppContent: React.FC = () => {
  const { pathname } = useLocation();

  // Set context-aware page title for all routes
  usePageTitle();

  return (
    <ErrorBoundary>
      {/* Keyed on pathname so the crossfade replays on every navigation. Pure
          opacity, 200ms: it marks that the view changed without asking anyone
          to wait for choreography before they can work. */}
      <div key={pathname} className="route-view motion-reduce:animate-none">
        <Routes>
        {/* Auth — signed-out visitors only. */}
        <Route path="/auth/login" element={<RequireAnonymous><LoginPage /></RequireAnonymous>} />
        <Route path="/auth/forgot-password" element={<RequireAnonymous><ForgotPasswordPage /></RequireAnonymous>} />
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/signup" element={<Navigate to="/auth/login" replace />} />

        {/* Dashboard — role-dispatched by RoleBasedDashboard */}
        <Route path="/" element={<RequireAbility ability="read" on="Event"><RoleBasedDashboard /></RequireAbility>} />
        <Route path="/dashboard" element={<RequireAbility ability="read" on="Event"><RoleBasedDashboard /></RequireAbility>} />

        {/* Platform administration. `read 'all'` is what an organizer lacks: it
            is granted only to admins, and /events lists every event through the
            unscoped getAllEvents() rather than one organizer's own. */}
        <Route path="/events" element={<RequireAbility ability="read" on="all"><ManageEventsPage /></RequireAbility>} />
        <Route path="/events/create" element={<RequireAbility ability="read" on="all"><CreateEventPage /></RequireAbility>} />
        <Route path="/events/edit/:eventId" element={<RequireAbility ability="read" on="all"><CreateEventPage /></RequireAbility>} />
        <Route path="/users" element={<RequireAbility ability="read" on="User"><AdminUsersPage /></RequireAbility>} />

        {/* Per-event workspace. The route gate is deliberately only area access:
            whether this caller may manage THIS event depends on ownership, which
            needs the loaded event, so EventWorkspacePage checks
            `<Can do="manage" on={asEvent(event)}>` once it has it. A conditional
            verb cannot be used here — CASL ignores conditions on a subject type. */}
        <Route path="/events/:eventId" element={<RequireAbility ability="read" on="Event"><EventWorkspacePage /></RequireAbility>} />
        <Route path="/events/:eventId/:tab" element={<RequireAbility ability="read" on="Event"><EventWorkspacePage /></RequireAbility>} />

        {/* Legacy deep-link forwarders for backwards compatibility */}
        <Route path="/attendees" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="attendees" label="attendees" /></RequireAbility>} />
        <Route path="/check-in" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="check-in" label="check-in" /></RequireAbility>} />
        <Route path="/payments" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="payments" label="payments" /></RequireAbility>} />
        <Route path="/emails" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="emails" label="emails" /></RequireAbility>} />
        <Route path="/certificates" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="certificates" label="certificates" /></RequireAbility>} />
        <Route path="/analytics" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="overview" label="analytics" /></RequireAbility>} />

        {/* Public */}
        <Route path="/e/:slug" element={<EventRegistrationPage />} />
        <Route path="/events/:eventId/register" element={<EventRegistrationPage />} />
        <Route path="/payment/:registrationId" element={<PaymentPage />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/registration/success" element={<PaymentSuccessPage />} />
        <Route path="/feedback/:eventId" element={<FeedbackPage />} />
        <Route path="/verify" element={<CertificateVerificationPage />} />
        <Route path="/verify/:code" element={<CertificateVerificationPage />} />

        {/* Authenticated but not permitted. Outside the gated table on purpose:
            a visitor being turned away must be able to read why. */}
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AbilityContextProvider>
        <div className="min-h-screen bg-surface-container-low">
          <AppContent />
          <Analytics />
        </div>
      </AbilityContextProvider>
    </AuthProvider>
  );
};

export default App;
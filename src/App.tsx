import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AbilityContextProvider from './auth/AbilityProvider';
import RequireAbility, { RequireAnonymous } from './auth/RequireAbility';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/home/HomePage';
import usePageTitle from './hooks/usePageTitle';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import AuthActionPage from './pages/auth/AuthActionPage';

// Events
import EventListPage from './pages/events/EventListPage';
import EventEditorPage from './pages/events/EventEditorPage';
import EventWorkspacePage from './pages/events/workspace/EventWorkspacePage';
import EventKioskPage from './pages/events/kiosk/EventKioskPage';
import LegacyRedirect from './pages/events/workspace/LegacyRedirect';
import LegacyRegisterRedirect from './pages/events/workspace/LegacyRegisterRedirect';

// Users
import UsersPage from './pages/users/UsersPage';

// Audit Logs (Admin only)
import AuditLogsPage from './pages/audit/AuditLogsPage';

// Attendee-facing
import RegistrationPage from './pages/registration/RegistrationPage';
import PaymentPage from './pages/payment/PaymentPage';
import TicketPage from './pages/ticket/TicketPage';
import LegacyTicketRedirect from './pages/ticket/LegacyTicketRedirect';
import FeedbackPage from './pages/feedback/FeedbackPage';
import CertificateVerificationPage from './pages/verification/CertificateVerificationPage';
import LegalPage from './pages/legal/LegalPage';
import NotFoundPage from './pages/errors/NotFoundPage';
import ForbiddenPage from './pages/errors/ForbiddenPage';

import AppLayout from './layout/AppLayout';

// Vercel Analytics
import { Analytics } from "@vercel/analytics/react"

const AppContent: React.FC = () => {
  // Set context-aware page title for all routes
  usePageTitle();

  return (
    <ErrorBoundary>
      <Routes>
        {/* Auth — signed-out visitors only. */}
        <Route path="/auth/login" element={<RequireAnonymous><LoginPage /></RequireAnonymous>} />
        <Route path="/auth/forgot-password" element={<RequireAnonymous><ForgotPasswordPage /></RequireAnonymous>} />
        <Route path="/auth/action" element={<AuthActionPage />} />
        <Route path="/__/auth/action" element={<AuthActionPage />} />
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/signup" element={<Navigate to="/auth/login" replace />} />

        {/* Persistent Layout Chrome for Authenticated Workspace & Management */}
        <Route element={<AppLayout />}>
          {/* Home — scope-dispatched by HomePage. `/dashboard` was retired here;
              vercel.json answers it with a 308 to `/` so old links survive. */}
          <Route path="/" element={<RequireAbility ability="read" on="Event"><HomePage /></RequireAbility>} />

          {/* Events Management: Organizers and Admins may access /events.
              Creation is gated on `create 'Event'` (`events.canCreate !== false`).
              Editing is area-gated on `read 'Event'`, with entity-level ownership
              verified inside EventEditorPage. Users is admin-only (`read 'User'`). */}
          <Route path="/events" element={<RequireAbility ability="read" on="Event"><EventListPage /></RequireAbility>} />
          <Route path="/events/create" element={<RequireAbility ability="create" on="Event"><EventEditorPage /></RequireAbility>} />
          <Route path="/events/edit/:eventId" element={<RequireAbility ability="read" on="Event"><EventEditorPage /></RequireAbility>} />
          <Route path="/users" element={<RequireAbility ability="read" on="User"><UsersPage /></RequireAbility>} />
          <Route path="/audit-logs" element={<RequireAbility ability="manage" on="AuditLog"><AuditLogsPage /></RequireAbility>} />

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
          <Route path="/payments" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="attendees" label="payments" /></RequireAbility>} />
          <Route path="/emails" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="attendees" label="emails" /></RequireAbility>} />
          <Route path="/certificates" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="certificates" label="certificates" /></RequireAbility>} />
          <Route path="/analytics" element={<RequireAbility ability="read" on="Event"><LegacyRedirect targetTab="overview" label="analytics" /></RequireAbility>} />
        </Route>

        {/* Public & standalone views */}
        <Route
          path="/events/:eventId/kiosk"
          element={
            <RequireAbility ability="read" on="Event">
              <EventKioskPage />
            </RequireAbility>
          }
        />
        <Route path="/events/:eventId/preview" element={<RegistrationPage isPreview={true} />} />
        <Route path="/e" element={<NotFoundPage />} />
        <Route path="/e/:slug" element={<RegistrationPage />} />
        <Route path="/events/:eventId/register" element={<LegacyRegisterRedirect />} />
        <Route path="/payment/:registrationId" element={<PaymentPage />} />
        <Route path="/ticket" element={<TicketPage />} />
        <Route path="/payment/success" element={<LegacyTicketRedirect />} />
        <Route path="/registration/success" element={<LegacyTicketRedirect mode="free" />} />
        <Route path="/feedback/:eventId" element={<FeedbackPage />} />
        <Route path="/verify" element={<CertificateVerificationPage />} />
        <Route path="/verify/:code" element={<CertificateVerificationPage />} />

        {/* Public Legal Pages */}
        <Route path="/privacy" element={<LegalPage documentType="privacy" />} />
        <Route path="/terms-of-service" element={<LegalPage documentType="terms" />} />
        <Route path="/terms" element={<Navigate to="/terms-of-service" replace />} />

        {/* Authenticated but not permitted. Outside the gated table on purpose:
            a visitor being turned away must be able to read why. */}
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
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
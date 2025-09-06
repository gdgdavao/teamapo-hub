import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLayout from './components/admin/AdminLayout';
import LoadingSpinner from './components/shared/UI/LoadingSpinner';
import { FirebaseConnectionStatus } from './components/shared/FirebaseConnectionStatus';
import RoleBasedDashboard from './components/shared/RoleBasedDashboard';
import usePageTitle from './hooks/usePageTitle';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Organizer Pages
import OrganizerDashboardPage from './pages/organizer/OrganizerDashboardPage';
import AttendeesPage from './pages/organizer/AttendeesPage';
import OrganizerCheckInPage from './pages/organizer/OrganizerCheckInPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminAttendeesPage from './pages/admin/AdminAttendeesPage';
import AdminCheckInPage from './pages/admin/AdminCheckInPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPaymentVerificationPage from './pages/admin/AdminPaymentVerificationPage';
import CreateEventPage from './pages/admin/AdminCreateEventPage';
import ManageEventsPage from './pages/admin/AdminManageEventsPage';

// Shared Pages
import CertificatesPage from './pages/shared/CertificatesPage';

// Analytics Component
import { AnalyticsPage } from './components/admin/Analytics';

// Utility Pages (keeping in their current locations for now)
import PaymentPage from './pages/payment/PaymentPage';
import PaymentSuccessPage from './pages/payment/PaymentSuccessPage';
import FeedbackPage from './pages/feedback/FeedbackPage';
import CertificateVerificationPage from './pages/verification/CertificateVerificationPage';
import NotFoundPage from './pages/error/NotFoundPage';

// Public Pages
import EventRegistrationPage from './pages/public/EventRegistrationPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  requiredRole?: 'organizer' | 'admin';
}> = ({ children, requiredRole }) => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!currentUser) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requiredRole && userProfile?.role !== requiredRole && userProfile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirects to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { loading } = useAuth();

  // Set context-aware page title for all routes
  usePageTitle();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      {/* Authentication Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/auth/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/auth/signup" element={
        <PublicRoute>
          <SignUpPage />
        </PublicRoute>
      } />
      <Route path="/auth/forgot-password" element={
        <PublicRoute>
          <ForgotPasswordPage />
        </PublicRoute>
      } />

      {/* Dashboard Routes - Role-based routing */}
      <Route path="/" element={
        <ProtectedRoute>
          <RoleBasedDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <RoleBasedDashboard />
        </ProtectedRoute>
      } />

      {/* Admin Dashboard */}
      <Route path="/admin/dashboard" element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboardPage />
        </ProtectedRoute>
      } />

      {/* Organizer Dashboard */}
      <Route path="/organizer/dashboard" element={
        <ProtectedRoute requiredRole="organizer">
          <OrganizerDashboardPage />
        </ProtectedRoute>
      } />
      
      {/* Organizer Check-In */}
      <Route path="/organizer/checkin" element={
        <ProtectedRoute requiredRole="organizer">
          <OrganizerCheckInPage />
        </ProtectedRoute>
      } />

      {/* Admin-only Routes */}
      <Route path="/admin/checkin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminCheckInPage />
        </ProtectedRoute>
      } />
      
      {/* Admin Event Management Routes */}
      <Route path="/admin/events/create" element={
        <ProtectedRoute requiredRole="admin">
          <CreateEventPage />
        </ProtectedRoute>
      } />

      <Route path="/admin/events/edit/:eventId" element={
        <ProtectedRoute requiredRole="admin">
          <CreateEventPage />
        </ProtectedRoute>
      } />

      <Route path="/admin/events/:eventId/attendees" element={
        <ProtectedRoute requiredRole="admin">
          <AdminAttendeesPage />
        </ProtectedRoute>
      } />

      <Route path="/admin/events/:eventId/analytics" element={
        <ProtectedRoute requiredRole="admin">
          <AnalyticsPage isEventSpecific={true} />
        </ProtectedRoute>
      } />

      <Route path="/admin/analytics" element={
        <ProtectedRoute requiredRole="admin">
          <AnalyticsPage isEventSpecific={false} />
        </ProtectedRoute>
      } />
      
      <Route path="/users" element={
        <ProtectedRoute requiredRole="admin">
          <AdminUsersPage />
        </ProtectedRoute>
      } />

      {/* Shared Routes - Available to both admin and organizer */}
      <Route path="/attendees" element={
        <ProtectedRoute>
          <AdminAttendeesPage />
        </ProtectedRoute>
      } />

      <Route path="/analytics" element={
        <ProtectedRoute>
          <AnalyticsPage isEventSpecific={false} />
        </ProtectedRoute>
      } />

      <Route path="/certificates" element={
        <ProtectedRoute>
          <CertificatesPage />
        </ProtectedRoute>
      } />

      {/* Unified Event Management Routes - Available to both admin and organizer */}
      <Route path="/events/create" element={
        <ProtectedRoute>
          <CreateEventPage />
        </ProtectedRoute>
      } />

      <Route path="/events/edit/:eventId" element={
        <ProtectedRoute>
          <CreateEventPage />
        </ProtectedRoute>
      } />

      <Route path="/events/:eventId/analytics" element={
        <ProtectedRoute>
          <AnalyticsPage isEventSpecific={true} />
        </ProtectedRoute>
      } />

      <Route path="/events/:eventId/attendees" element={
        <ProtectedRoute>
          <AttendeesPage />
        </ProtectedRoute>
      } />



      <Route path="/events" element={
        <ProtectedRoute requiredRole="admin">
          <ManageEventsPage />
        </ProtectedRoute>
      } />

      {/* Payment Routes - Keep for admin/organizer access */}
      <Route path="/payment/:registrationId" element={<PaymentPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />

      {/* Feedback Route - Keep for admin/organizer access */}
      <Route path="/feedback/:eventId" element={<FeedbackPage />} />

      {/* Certificate Verification Route */}
      <Route path="/verify/:code" element={<CertificateVerificationPage />} />
      <Route path="/verify" element={<CertificateVerificationPage />} />

      {/* Public Event Registration Route */}
      <Route path="/events/:eventId/register" element={<EventRegistrationPage />} />

      {/* 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AppContent />
        <FirebaseConnectionStatus />
      </div>
    </AuthProvider>
  );
};

export default App;
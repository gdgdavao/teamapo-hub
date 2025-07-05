import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import AdminLayout from './components/AdminLayout';
import LoadingSpinner from './components/UI/LoadingSpinner';
import { FirebaseConnectionStatus } from './components/FirebaseConnectionStatus';
import { isAdminSubdomain, getAdminUrl } from './utils/subdomain';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import EventsPage from './pages/public/EventsPage';
import EventDetailPage from './pages/public/EventDetailPage';
import RegisterPage from './pages/public/RegisterPage';
import LoginPage from './pages/auth/LoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Protected Pages - Organizer
import OrganizerDashboardPage from './pages/organizer/OrganizerDashboardPage';
import CreateEventPage from './pages/organizer/CreateEventPage';
import ManageEventsPage from './pages/organizer/ManageEventsPage';
import EventAnalyticsPage from './pages/organizer/EventAnalyticsPage';
import AttendeesPage from './pages/organizer/AttendeesPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminEventsPage from './pages/admin/AdminEventsPage';
import AdminAttendeesPage from './pages/admin/AdminAttendeesPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminCertificatesPage from './pages/admin/AdminCertificatesPage';
import AdminFormsPage from './pages/admin/AdminFormsPage';
import AdminSocialPage from './pages/admin/AdminSocialPage';
import AdminPaymentVerificationPage from './pages/admin/AdminPaymentVerificationPage';

// Utility Pages
import PaymentPage from './pages/payment/PaymentPage';
import PaymentSuccessPage from './pages/payment/PaymentSuccessPage';
import FeedbackPage from './pages/feedback/FeedbackPage';
import CertificateVerificationPage from './pages/verification/CertificateVerificationPage';
import NotFoundPage from './pages/error/NotFoundPage';

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
    // Check if we're on apohub subdomain
    if (isAdminSubdomain()) {
      return <Navigate to="/auth/login" replace />;
    } else {
      // Redirect to apohub subdomain for authentication (admin and organizer roles)
      window.location.href = getAdminUrl('/auth/login');
      return <LoadingSpinner />;
    }
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

// Redirect to Apohub Component
const RedirectToApohub: React.FC<{ path: string }> = ({ path }) => {
  React.useEffect(() => {
    window.location.href = getAdminUrl(path);
  }, [path]);

  return <LoadingSpinner />;
};

const AppContent: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Check if we're on apohub subdomain (for admin and organizer roles)
  const isApohub = isAdminSubdomain();

  if (isApohub) {
    // Apohub subdomain routes - for admin and organizer authentication and management
    return (
      <Routes>
        {/* Authentication Routes - Available on apohub subdomain */}
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
            <AdminDashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AdminDashboardPage />
          </ProtectedRoute>
        } />

        {/* Admin-only Routes */}
        <Route path="/events" element={
          <ProtectedRoute requiredRole="admin">
            <AdminEventsPage />
          </ProtectedRoute>
        } />

        <Route path="/attendees" element={
          <ProtectedRoute requiredRole="admin">
            <AdminAttendeesPage />
          </ProtectedRoute>
        } />

        <Route path="/users" element={
          <ProtectedRoute requiredRole="admin">
            <AdminUsersPage />
          </ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute requiredRole="admin">
            <AdminAnalyticsPage />
          </ProtectedRoute>
        } />

        <Route path="/certificates" element={
          <ProtectedRoute requiredRole="admin">
            <AdminCertificatesPage />
          </ProtectedRoute>
        } />

        <Route path="/forms" element={
          <ProtectedRoute requiredRole="admin">
            <AdminFormsPage />
          </ProtectedRoute>
        } />

        <Route path="/social" element={
          <ProtectedRoute requiredRole="admin">
            <AdminSocialPage />
          </ProtectedRoute>
        } />

        <Route path="/payment-verification" element={
          <ProtectedRoute requiredRole="admin">
            <AdminPaymentVerificationPage />
          </ProtectedRoute>
        } />

        {/* Event Management Routes - Available to both admin and organizer */}
        <Route path="/events/create" element={
          <ProtectedRoute requiredRole="organizer">
            <CreateEventPage />
          </ProtectedRoute>
        } />

        <Route path="/events/edit/:eventId" element={
          <ProtectedRoute requiredRole="organizer">
            <CreateEventPage />
          </ProtectedRoute>
        } />

        <Route path="/manage-events" element={
          <ProtectedRoute requiredRole="organizer">
            <ManageEventsPage />
          </ProtectedRoute>
        } />

        <Route path="/events/:eventId/analytics" element={
          <ProtectedRoute requiredRole="organizer">
            <EventAnalyticsPage />
          </ProtectedRoute>
        } />

        <Route path="/events/:eventId/attendees" element={
          <ProtectedRoute requiredRole="organizer">
            <AttendeesPage />
          </ProtectedRoute>
        } />

        {/* Organizer Routes - Alternative paths */}
        <Route path="/organizer" element={
          <ProtectedRoute requiredRole="organizer">
            <OrganizerDashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/organizer/create" element={
          <ProtectedRoute requiredRole="organizer">
            <CreateEventPage />
          </ProtectedRoute>
        } />

        <Route path="/organizer/events" element={
          <ProtectedRoute requiredRole="organizer">
            <ManageEventsPage />
          </ProtectedRoute>
        } />

        <Route path="/organizer/events/:eventId/analytics" element={
          <ProtectedRoute requiredRole="organizer">
            <EventAnalyticsPage />
          </ProtectedRoute>
        } />

        <Route path="/organizer/events/:eventId/attendees" element={
          <ProtectedRoute requiredRole="organizer">
            <AttendeesPage />
          </ProtectedRoute>
        } />

        {/* 404 Route for apohub subdomain */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  // Main domain routes - Public access only
  return (
    <Routes>
      {/* Landing Page - without header/footer */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Public Routes - with header/footer */}
      <Route path="/" element={<Layout />}>
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="events/:eventId/register" element={<RegisterPage />} />
        <Route path="verify/:code" element={<CertificateVerificationPage />} />
        <Route path="verify" element={<CertificateVerificationPage />} />
      </Route>

      {/* Authentication Routes - Redirect to apohub subdomain */}
      <Route path="/auth/login" element={<RedirectToApohub path="/auth/login" />} />
      <Route path="/auth/signup" element={<RedirectToApohub path="/auth/signup" />} />
      <Route path="/auth/forgot-password" element={<RedirectToApohub path="/auth/forgot-password" />} />
      <Route path="/login" element={<RedirectToApohub path="/login" />} />
      <Route path="/signup" element={<RedirectToApohub path="/auth/signup" />} />

      {/* Management Routes - Redirect to apohub subdomain */}
      <Route path="/dashboard" element={<RedirectToApohub path="/dashboard" />} />
      <Route path="/organizer/*" element={<RedirectToApohub path="/organizer" />} />
      <Route path="/admin/*" element={<RedirectToApohub path="/admin" />} />

      {/* Payment Routes - Keep on main domain for public access */}
      <Route path="/payment/:registrationId" element={<PaymentPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />

      {/* Feedback Route - Keep on main domain for public access */}
      <Route path="/feedback/:eventId" element={<FeedbackPage />} />

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
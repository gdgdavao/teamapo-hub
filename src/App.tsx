import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import AdminLayout from './components/AdminLayout';
import LoadingSpinner from './components/UI/LoadingSpinner';
import { isAdminSubdomain } from './utils/subdomain';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import EventsPage from './pages/public/EventsPage';
import EventDetailPage from './pages/public/EventDetailPage';
import RegisterPage from './pages/public/RegisterPage';
import LoginPage from './pages/auth/LoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Protected Pages - Attendee
import DashboardPage from './pages/attendee/DashboardPage';
import MyEventsPage from './pages/attendee/MyEventsPage';
import MyCertificatesPage from './pages/attendee/MyCertificatesPage';
import ProfilePage from './pages/attendee/ProfilePage';

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
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminCertificatesPage from './pages/admin/AdminCertificatesPage';
import AdminFormsPage from './pages/admin/AdminFormsPage';
import AdminSocialPage from './pages/admin/AdminSocialPage';

// Utility Pages
import PaymentPage from './pages/payment/PaymentPage';
import PaymentSuccessPage from './pages/payment/PaymentSuccessPage';
import FeedbackPage from './pages/feedback/FeedbackPage';
import CertificateVerificationPage from './pages/verification/CertificateVerificationPage';
import NotFoundPage from './pages/error/NotFoundPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  requiredRole?: 'attendee' | 'organizer' | 'admin';
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

  if (loading) {
    return <LoadingSpinner />;
  }

  // Check if we're on admin subdomain
  const isAdmin = isAdminSubdomain();

  if (isAdmin) {
    // Admin subdomain routes
    return (
      <Routes>
        {/* Admin Authentication Routes */}
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

        {/* Admin Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/events" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout>
              <AdminEventsPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/attendees" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout>
              <AdminAttendeesPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout>
              <AdminAnalyticsPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/certificates" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout>
              <AdminCertificatesPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/forms" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout>
              <AdminFormsPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/social" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout>
              <AdminSocialPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 404 Route for admin */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  // Main domain routes
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="events/:eventId/register" element={<RegisterPage />} />
        <Route path="verify/:certificateId" element={<CertificateVerificationPage />} />
      </Route>

      {/* Authentication Routes */}
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

      {/* Protected Routes - General */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Protected Routes - Attendee */}
      <Route path="/my" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="events" element={<MyEventsPage />} />
        <Route path="certificates" element={<MyCertificatesPage />} />
      </Route>

      {/* Protected Routes - Organizer */}
      <Route path="/organizer" element={
        <ProtectedRoute requiredRole="organizer">
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<OrganizerDashboardPage />} />
        <Route path="create" element={<CreateEventPage />} />
        <Route path="events" element={<ManageEventsPage />} />
        <Route path="events/:eventId/analytics" element={<EventAnalyticsPage />} />
        <Route path="events/:eventId/attendees" element={<AttendeesPage />} />
      </Route>

      {/* Payment Routes */}
      <Route path="/payment/:registrationId" element={
        <ProtectedRoute>
          <PaymentPage />
        </ProtectedRoute>
      } />
      <Route path="/payment/success" element={
        <ProtectedRoute>
          <PaymentSuccessPage />
        </ProtectedRoute>
      } />

      {/* Feedback Route */}
      <Route path="/feedback/:eventId" element={
        <ProtectedRoute>
          <FeedbackPage />
        </ProtectedRoute>
      } />

      {/* Backward compatibility for old login routes */}
      <Route path="/login" element={<Navigate to="/auth/login" replace />} />
      <Route path="/signup" element={<Navigate to="/auth/signup" replace />} />

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
      </div>
    </AuthProvider>
  );
};

export default App;
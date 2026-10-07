import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { describe, it, expect, vi } from 'vitest';
import { defineAbilityFor } from '@/auth/ability';

// Mock Firebase services to avoid actual network or uninitialized app calls in DOM tests
vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

vi.mock('@/services/eventService', () => ({
  EventService: {
    getEvent: vi.fn().mockResolvedValue(null),
    getEvents: vi.fn().mockResolvedValue([]),
    getAllEvents: vi.fn().mockResolvedValue([]),
    getPublishedEvents: vi.fn().mockResolvedValue([]),
    getEventsByOrganizer: vi.fn().mockResolvedValue([]),
    getEventBySlug: vi.fn().mockResolvedValue(null),
    subscribeToEvents: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    getRegistrations: vi.fn().mockResolvedValue([]),
    getRegistrationsByEvent: vi.fn().mockResolvedValue([]),
    getAllRegistrations: vi.fn().mockResolvedValue([]),
    getRegistration: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/analyticsService', () => ({
  AnalyticsService: {
    getEventAnalytics: vi.fn().mockResolvedValue({}),
    getAttendeeGrowth: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({
      totalEvents: 0,
      totalAttendees: 0,
      totalRevenue: 0,
      checkInRate: 0,
    }),
  },
}));

vi.mock('@/services/certificateService', () => ({
  CertificateService: {
    getCertificatesByEvent: vi.fn().mockResolvedValue([]),
    verifyCertificate: vi.fn().mockResolvedValue(null),
    getAllTemplates: vi.fn().mockResolvedValue([]),
    getAllIssuedCertificates: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/feedbackService', () => ({
  FeedbackService: {
    getFeedbackByEvent: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/paymentService', () => ({
  PaymentService: {
    getPaymentVerifications: vi.fn().mockResolvedValue([]),
    getAllPaymentProofs: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/userService', () => ({
  UserService: {
    getUsers: vi.fn().mockResolvedValue([]),
    getAllUsers: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/notificationService', () => ({
  NotificationService: {
    getNotifications: vi.fn().mockResolvedValue([]),
    subscribeToNotifications: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@/services/emailService', () => ({
  EmailService: {
    getEmailLogs: vi.fn().mockResolvedValue([]),
    getAllEmails: vi.fn().mockResolvedValue([]),
  },
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'test-admin', email: 'admin@gdgdavao.org', displayName: 'Admin' },
    userProfile: { uid: 'test-admin', email: 'admin@gdgdavao.org', role: 'admin', isActive: true, displayName: 'Admin' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    updateUserProfile: vi.fn(),
    refreshUserProfile: vi.fn(),
    createUser: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Chart.js / canvas if used
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  registerables: [],
}));
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-chart">Bar Chart</div>,
  Line: () => <div data-testid="mock-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="mock-chart">Doughnut Chart</div>,
}));

// Mock ZXing browser QR scanner
vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromVideoDevice = vi.fn();
    reset = vi.fn();
  },
}));

/**
 * Pages are rendered bare inside MemoryRouter, so anything reaching for the
 * ability needs one supplied here. Matches the AuthContext mock above: an
 * active admin, which is the widest surface and therefore the most likely to
 * throw on a missing guard.
 */
const TEST_ABILITY = defineAbilityFor({
  uid: 'test-admin',
  role: 'admin',
  isActive: true,
});

describe('All Pages Integrity Test', () => {
  const pages: { name: string; loader: () => Promise<any> }[] = [
    { name: 'LoginPage', loader: () => import('@/pages/auth/LoginPage') },
    { name: 'ForgotPasswordPage', loader: () => import('@/pages/auth/ForgotPasswordPage') },
    { name: 'NotFoundPage', loader: () => import('@/pages/error/NotFoundPage') },
    { name: 'PaymentPage', loader: () => import('@/pages/payment/PaymentPage') },
    { name: 'PaymentSuccessPage', loader: () => import('@/pages/payment/PaymentSuccessPage') },
    { name: 'FeedbackPage', loader: () => import('@/pages/feedback/FeedbackPage') },
    { name: 'CertificateVerificationPage', loader: () => import('@/pages/verification/CertificateVerificationPage') },
    { name: 'EventRegistrationPage', loader: () => import('@/pages/public/EventRegistrationPage') },
    { name: 'OrganizerDashboardPage', loader: () => import('@/pages/organizer/OrganizerDashboardPage') },
    { name: 'AdminDashboardPage', loader: () => import('@/pages/admin/AdminDashboardPage') },
    { name: 'AdminCreateEventPage', loader: () => import('@/pages/admin/AdminCreateEventPage') },
    { name: 'AdminManageEventsPage', loader: () => import('@/pages/admin/AdminManageEventsPage') },
    { name: 'AdminUsersPage', loader: () => import('@/pages/admin/AdminUsersPage') },
    { name: 'AdminAttendeesPage', loader: () => import('@/pages/admin/AdminAttendeesPage') },
    { name: 'AdminCheckInPage', loader: () => import('@/pages/admin/AdminCheckInPage') },
    { name: 'AdminPaymentVerificationPage', loader: () => import('@/pages/admin/AdminPaymentVerificationPage') },
    { name: 'AdminEmailManagementPage', loader: () => import('@/pages/admin/AdminEmailManagementPage') },
    { name: 'AdminEventFeedbackPage', loader: () => import('@/pages/admin/AdminEventFeedbackPage') },
    { name: 'AdminAnalyticsPage', loader: () => import('@/pages/admin/AdminAnalyticsPage') },
    { name: 'CertificatesPage', loader: () => import('@/pages/shared/CertificatesPage') },
    { name: 'EventWorkspacePage', loader: () => import('@/pages/admin/EventWorkspacePage') },
    { name: 'LegacyRedirect', loader: () => import('@/pages/admin/LegacyRedirect') },
  ];

  for (const { name, loader } of pages) {
    it(`renders ${name} without throwing errors`, async () => {
      const module = await loader();
      const Component = module.default || module[name];
      expect(Component, `${name} has valid export`).toBeDefined();

      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <AbilityProvider value={TEST_ABILITY}>
            <Component />
          </AbilityProvider>
        </MemoryRouter>
      );
      expect(container).toBeDefined();
    });
  }
});

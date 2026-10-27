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
    getFeedbackForm: vi.fn().mockResolvedValue({ fields: [] }),
    subscribeToEvents: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    getRegistrations: vi.fn().mockResolvedValue([]),
    getRegistrationsByEvent: vi.fn().mockResolvedValue([]),
    getRegistrationsByOrganizer: vi.fn().mockResolvedValue([]),
    getAllRegistrations: vi.fn().mockResolvedValue([]),
    getRegistration: vi.fn().mockResolvedValue(null),
    getEventRegistrations: vi.fn().mockResolvedValue([]),
    updateRegistrationStatus: vi.fn().mockResolvedValue(undefined),
    updateAttendeeDetails: vi.fn().mockResolvedValue(undefined),
    deleteRegistration: vi.fn().mockResolvedValue(undefined),
    sendPaymentNotification: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/services/analyticsService', () => ({
  AnalyticsService: {
    getEventAnalytics: vi.fn().mockResolvedValue({}),
    getAttendeeGrowth: vi.fn().mockResolvedValue([]),
    getEventStats: vi.fn().mockResolvedValue({}),
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
    getEventFeedback: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/paymentService', () => ({
  PaymentService: {
    getPaymentVerifications: vi.fn().mockResolvedValue([]),
    getLatestPaymentProofByRegistrationId: vi.fn().mockResolvedValue(null),
    verifyPaymentProof: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/userService', () => ({
  UserService: {
    getUsers: vi.fn().mockResolvedValue([]),
    getAllUsers: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/emailService', () => ({
  EmailService: {
    getEventEmailLog: vi.fn().mockResolvedValue([]),
    getAttendeeEmails: vi.fn().mockResolvedValue([]),
    exportEmailLogs: vi.fn().mockReturnValue(''),
    resendEmail: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  },
}));

vi.mock('@/services/auditLogService', () => ({
  AuditLogService: {
    getAuditLogs: vi.fn().mockResolvedValue({ logs: [], hasMore: false }),
    recordAuditLog: vi.fn().mockResolvedValue({ success: true }),
    exportToCSV: vi.fn(),
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

/** A real-looking id for the workspace tabs, which require one. */
const EVENT_ID = 'test-event-001';

describe('All Pages Integrity Test', () => {
  // `props` is passed straight through to the component. The workspace tabs take
  // a required eventId, and MemoryRouter renders at '/' where no :eventId param
  // exists - so without this they would mount with eventId undefined and settle
  // on their not-found branch, which renders without throwing but exercises
  // almost nothing. Passing a real id is what makes this a smoke test of the
  // component rather than of its error path.
  const pages: {
    name: string;
    loader: () => Promise<any>;
    props?: Record<string, unknown>;
  }[] = [
    { name: 'LoginPage', loader: () => import('@/pages/auth/LoginPage') },
    { name: 'ForgotPasswordPage', loader: () => import('@/pages/auth/ForgotPasswordPage') },
    { name: 'AuthActionPage', loader: () => import('@/pages/auth/AuthActionPage') },
    { name: 'NotFoundPage', loader: () => import('@/pages/errors/NotFoundPage') },
    { name: 'ForbiddenPage', loader: () => import('@/pages/errors/ForbiddenPage') },
    { name: 'HomePage', loader: () => import('@/pages/home/HomePage') },
    { name: 'PaymentPage', loader: () => import('@/pages/payment/PaymentPage') },
    { name: 'TicketPage', loader: () => import('@/pages/ticket/TicketPage') },
    { name: 'FeedbackPage', loader: () => import('@/pages/feedback/FeedbackPage') },
    { name: 'CertificateVerificationPage', loader: () => import('@/pages/verification/CertificateVerificationPage') },
    { name: 'RegistrationPage', loader: () => import('@/pages/registration/RegistrationPage') },
    { name: 'ScopedHome', loader: () => import('@/pages/home/scoped/ScopedHome') },
    { name: 'PlatformHome', loader: () => import('@/pages/home/platform/PlatformHome') },
    { name: 'EventEditorPage', loader: () => import('@/pages/events/EventEditorPage') },
    { name: 'EventListPage', loader: () => import('@/pages/events/EventListPage') },
    { name: 'UsersPage', loader: () => import('@/pages/users/UsersPage') },
    { name: 'AuditLogsPage', loader: () => import('@/pages/audit/AuditLogsPage') },
    { name: 'OverviewTab', loader: () => import('@/pages/events/workspace/tabs/OverviewTab'), props: { eventId: EVENT_ID } },
    { name: 'AttendeesTab', loader: () => import('@/pages/events/workspace/tabs/AttendeesTab'), props: { eventId: EVENT_ID } },
    { name: 'CheckInTab', loader: () => import('@/pages/events/workspace/tabs/CheckInTab'), props: { eventId: EVENT_ID } },
    { name: 'PromoCodesTab', loader: () => import('@/pages/events/workspace/tabs/PromoCodesTab'), props: { eventId: EVENT_ID } },
    { name: 'CertificatesTab', loader: () => import('@/pages/events/workspace/tabs/CertificatesTab'), props: { eventId: EVENT_ID } },
    { name: 'FeedbackTab', loader: () => import('@/pages/events/workspace/tabs/FeedbackTab'), props: { eventId: EVENT_ID } },
    { name: 'EventWorkspacePage', loader: () => import('@/pages/events/workspace/EventWorkspacePage') },
    { name: 'LegacyRedirect', loader: () => import('@/pages/events/workspace/LegacyRedirect') },
    { name: 'LegalPage', loader: () => import('@/pages/legal/LegalPage') },
  ];

  for (const { name, loader, props } of pages) {
    it(`renders ${name} without throwing errors`, async () => {
      const module = await loader();
      const Component = module.default || module[name];
      expect(Component, `${name} has valid export`).toBeDefined();

      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <AbilityProvider value={TEST_ABILITY}>
            <Component {...props} />
          </AbilityProvider>
        </MemoryRouter>
      );
      expect(container).toBeDefined();
    });
  }
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineAbilityFor } from '@/auth/ability';
import PlatformHome from '@/pages/home/platform/PlatformHome';
import TrendPanel from '@/pages/home/TrendPanel';
import { AnalyticsService } from '@/services/analyticsService';
import { RegistrationService } from '@/services/registrationService';
import type { Registration } from '@/types';

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/analyticsService', () => ({
  AnalyticsService: {
    getDashboardStats: vi.fn(),
  },
}));

vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    getAllRegistrations: vi.fn(),
  },
}));

vi.mock('@/services/eventService', () => ({
  EventService: {
    getEvents: vi.fn().mockResolvedValue([]),
    getAllEvents: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'admin-1', email: 'admin@gdgdavao.org', displayName: 'Admin User' },
    userProfile: { uid: 'admin-1', email: 'admin@gdgdavao.org', role: 'admin', isActive: true, displayName: 'Admin User' },
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const TEST_ABILITY = defineAbilityFor({
  uid: 'admin-1',
  role: 'admin',
  isActive: true,
});

const DEFAULT_STATS = {
  totalEvents: 5,
  totalRegistrations: 42,
  pendingApprovals: 3,
  certificatesIssued: 10,
  upcomingEvents: 2,
  monthlyGrowth: {
    events: 10,
    registrations: 25,
    certificates: null,
  },
  totalRevenue: 5000,
  pendingPayments: 3,
};

describe('Home states and interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPlatformHome = () =>
    render(
      <MemoryRouter initialEntries={['/']}>
        <AbilityProvider value={TEST_ABILITY}>
          <PlatformHome />
        </AbilityProvider>
      </MemoryRouter>
    );

  it('renders an empty state on failure and retries on demand', async () => {
    const user = userEvent.setup();

    // First call rejects
    vi.mocked(AnalyticsService.getDashboardStats).mockRejectedValueOnce(
      new Error('Failed network request')
    );
    vi.mocked(RegistrationService.getAllRegistrations).mockResolvedValueOnce([]);

    renderPlatformHome();

    // Verify error state is shown instead of misleading zeros
    expect(
      await screen.findByText("Couldn't load your dashboard")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The numbers did not come back/i)
    ).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Prepare success response for retry
    vi.mocked(AnalyticsService.getDashboardStats).mockResolvedValueOnce(DEFAULT_STATS);
    vi.mocked(RegistrationService.getAllRegistrations).mockResolvedValueOnce([]);

    await user.click(retryButton);

    // After retry, the dashboard content mounts successfully
    expect(await screen.findByLabelText('Platform totals')).toBeInTheDocument();
    expect(AnalyticsService.getDashboardStats).toHaveBeenCalledTimes(2);
  });

  it('deep-links the admin pending review CTA to the event with the largest backlog', async () => {
    vi.mocked(AnalyticsService.getDashboardStats).mockResolvedValue(DEFAULT_STATS);

    const mockRegistrations = [
      // Event 1 has 1 pending
      {
        id: 'reg-1',
        eventId: 'event-alpha',
        status: 'pending',
        registrationDate: new Date(),
      },
      // Event 2 has 3 pending
      {
        id: 'reg-2',
        eventId: 'event-beta',
        status: 'pending',
        registrationDate: new Date(),
      },
      {
        id: 'reg-3',
        eventId: 'event-beta',
        status: 'pending',
        registrationDate: new Date(),
      },
      {
        id: 'reg-4',
        eventId: 'event-beta',
        status: 'pending',
        registrationDate: new Date(),
      },
      // Event 2 also has 1 approved
      {
        id: 'reg-5',
        eventId: 'event-beta',
        status: 'approved',
        paymentStatus: 'paid',
        registrationDate: new Date(),
      },
    ] as Registration[];

    vi.mocked(RegistrationService.getAllRegistrations).mockResolvedValue(mockRegistrations);

    renderPlatformHome();

    // Backlog section targets event-beta with 3 items
    expect(
      await screen.findByText('3 registrations need your review')
    ).toBeInTheDocument();

    const reviewButton = screen.getByRole('link', { name: 'Review 3' });
    expect(reviewButton).toHaveAttribute(
      'href',
      '/events/event-beta/attendees?status=pending'
    );
  });

  it('renders an empty backlog state when zero registrations are pending', async () => {
    vi.mocked(AnalyticsService.getDashboardStats).mockResolvedValue(DEFAULT_STATS);
    vi.mocked(RegistrationService.getAllRegistrations).mockResolvedValue([
      {
        id: 'reg-1',
        eventId: 'event-alpha',
        status: 'approved',
        paymentStatus: 'paid',
        registrationDate: new Date(),
      } as Registration,
    ]);

    renderPlatformHome();

    expect(await screen.findByText('Nothing waiting on you')).toBeInTheDocument();

    const createButton = screen.getByRole('link', { name: 'Create an event' });
    expect(createButton).toHaveAttribute('href', '/events/create');

    expect(screen.queryByRole('link', { name: 'Manage users' })).not.toBeInTheDocument();
  });

  it('switches between Registrations and Revenue series and changes time ranges in TrendPanel', async () => {
    const user = userEvent.setup();

    const registrations = [
      {
        registrationDate: new Date('2026-10-03T02:00:00Z'),
        paymentStatus: 'paid',
        totalAmount: 500,
      },
      {
        registrationDate: new Date('2026-10-04T05:00:00Z'),
        paymentStatus: 'paid',
        totalAmount: 250,
      },
      {
        registrationDate: new Date('2026-10-04T06:00:00Z'),
        paymentStatus: 'pending',
        totalAmount: 999,
      },
    ] as Registration[];

    render(
      <MemoryRouter>
        <TrendPanel registrations={registrations} />
      </MemoryRouter>
    );

    // Initial state: Registrations series
    expect(screen.getByRole('heading', { level: 2, name: 'Registrations trend' })).toBeInTheDocument();
    expect(screen.getByText(/3 over the last 30 days/i)).toBeInTheDocument();

    // Click Revenue series radio
    const revenueRadio = screen.getByRole('radio', { name: 'Revenue' });
    await user.click(revenueRadio);

    // Switches to Revenue series with currency total (₱750 from the 2 paid registrations)
    expect(screen.getByRole('heading', { level: 2, name: 'Revenue trend' })).toBeInTheDocument();
    expect(screen.getByText(/₱750 over the last 30 days/i)).toBeInTheDocument();

    // Click 90 days range radio
    const range90Radio = screen.getByRole('radio', { name: '90 days' });
    await user.click(range90Radio);

    expect(screen.getByText(/₱750 over the last 90 days/i)).toBeInTheDocument();
  });
});

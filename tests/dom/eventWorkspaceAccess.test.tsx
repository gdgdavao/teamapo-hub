import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { defineAbilityFor } from '@/auth/ability';
import EventWorkspacePage from '@/pages/events/workspace/EventWorkspacePage';
import { EventService } from '@/services/eventService';
import { AnalyticsService } from '@/services/analyticsService';
import { RegistrationService } from '@/services/registrationService';

let mockAuthUser: any = null;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockAuthUser ? { uid: mockAuthUser.uid, email: mockAuthUser.email } : null,
    userProfile: mockAuthUser,
    loading: false,
  }),
}));

vi.mock('@/services/eventService', () => ({
  EventService: {
    getEvent: vi.fn(),
  },
}));

vi.mock('@/services/analyticsService', () => ({
  AnalyticsService: {
    getEventStats: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    prefetchEventRegistrations: vi.fn(),
    getEventRegistrations: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock workspace tabs to lightweight stubs
vi.mock('@/pages/events/workspace/tabs/OverviewTab', () => ({
  default: () => <div data-testid="overview-tab">Overview Tab Content</div>,
}));
vi.mock('@/pages/events/workspace/tabs/AttendeesTab', () => ({
  default: () => <div data-testid="attendees-tab">Attendees Tab Content</div>,
}));

describe('EventWorkspacePage - Hybrid RBAC + ABPAC Access & Safe Prewarm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWorkspace = (eventId: string) => {
    const ability = defineAbilityFor(mockAuthUser);
    return render(
      <MemoryRouter initialEntries={[`/events/${eventId}`]}>
        <AbilityProvider value={ability}>
          <Routes>
            <Route path="/events/:eventId" element={<EventWorkspacePage />} />
            <Route path="/events/:eventId/:tab" element={<EventWorkspacePage />} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>
    );
  };

  it('allows any active organizer to enter workspace and prewarms stats under communal model', async () => {
    mockAuthUser = {
      uid: 'org-visitor',
      email: 'visitor@gdgdavao.org',
      role: 'organizer',
      isActive: true,
      displayName: 'Visiting Organizer',
    };

    const foreignEvent = {
      id: 'event-foreign',
      slug: 'community-ai-day',
      title: 'Community AI Day',
      status: 'published',
      startDate: new Date('2026-12-01T08:00:00Z'),
      ticketTypes: [],
      currentAttendees: 40,
    };

    vi.mocked(EventService.getEvent).mockResolvedValueOnce(foreignEvent as any);

    renderWorkspace('event-foreign');

    const titles = await screen.findAllByText('Community AI Day');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();

    // Verify prewarm calls were executed for active organizer
    expect(AnalyticsService.getEventStats).toHaveBeenCalledWith('event-foreign');
    expect(RegistrationService.prefetchEventRegistrations).toHaveBeenCalledWith('event-foreign');
  });

  it('allows event owner organizer to access workspace and prewarms stats safely', async () => {
    mockAuthUser = {
      uid: 'org-owner',
      email: 'lead@gdgdavao.org',
      role: 'organizer',
      isActive: true,
      displayName: 'Lead Organizer',
    };

    const ownedEvent = {
      id: 'event-owned',
      slug: 'community-ai-day',
      title: 'Community AI Day',
      status: 'published',
      organizer: { uid: 'org-owner', name: 'Lead Organizer', email: 'lead@gdgdavao.org' },
      startDate: new Date('2026-12-01T08:00:00Z'),
      ticketTypes: [],
      currentAttendees: 40,
    };

    vi.mocked(EventService.getEvent).mockResolvedValueOnce(ownedEvent as any);

    renderWorkspace('event-owned');

    // Title appears in workspace (in AppShell header and breadcrumbs)
    const titles = await screen.findAllByText('Community AI Day');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();

    // Owner gets safe prewarm
    expect(AnalyticsService.getEventStats).toHaveBeenCalledWith('event-owned');
    expect(RegistrationService.prefetchEventRegistrations).toHaveBeenCalledWith('event-owned');
  });

  it('allows platform admin to access foreign workspace and prewarms stats', async () => {
    mockAuthUser = {
      uid: 'admin-root',
      email: 'admin@gdgdavao.org',
      role: 'admin',
      isActive: true,
      displayName: 'Root Admin',
    };

    const foreignEvent = {
      id: 'event-foreign-2',
      slug: 'devfest-2026',
      title: 'GDG DevFest 2026',
      status: 'published',
      organizer: { uid: 'org-other', name: 'Other Organizer', email: 'other@gdgdavao.org' },
      startDate: new Date('2026-11-20T08:00:00Z'),
      ticketTypes: [],
      currentAttendees: 200,
    };

    vi.mocked(EventService.getEvent).mockResolvedValueOnce(foreignEvent as any);

    renderWorkspace('event-foreign-2');

    const adminTitles = await screen.findAllByText('GDG DevFest 2026');
    expect(adminTitles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();

    expect(AnalyticsService.getEventStats).toHaveBeenCalledWith('event-foreign-2');
    expect(RegistrationService.prefetchEventRegistrations).toHaveBeenCalledWith('event-foreign-2');
  });

  it('renders Event Not Found when event document does not exist', async () => {
    mockAuthUser = {
      uid: 'org-1',
      email: 'org@gdgdavao.org',
      role: 'organizer',
      isActive: true,
      displayName: 'Organizer',
    };

    vi.mocked(EventService.getEvent).mockResolvedValueOnce(null);

    renderWorkspace('non-existent-event');

    expect(await screen.findByText('Event Not Found')).toBeInTheDocument();
    expect(screen.getByText(/The event you are looking for may have been removed or does not exist/i)).toBeInTheDocument();
  });
});

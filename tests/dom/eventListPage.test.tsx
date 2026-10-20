import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineAbilityFor } from '@/auth/ability';
import EventListPage from '@/pages/events/EventListPage';
import { EventService } from '@/services/eventService';
import { RegistrationService } from '@/services/registrationService';

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

let mockAuthProfile: any = {
  uid: 'admin-1',
  email: 'admin@gdgdavao.org',
  role: 'admin',
  isActive: true,
  displayName: 'Admin User',
};

vi.mock('@/services/eventService', () => ({
  EventService: {
    getAllEvents: vi.fn(),
    getEventsByOrganizer: vi.fn().mockResolvedValue([]),
    getPublishedEvents: vi.fn().mockResolvedValue([]),
    prefetchEvent: vi.fn(),
  },
}));

vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    getEventRegistrations: vi.fn().mockResolvedValue([]),
    getAllRegistrations: vi.fn().mockResolvedValue([]),
    getRegistrationsByOrganizer: vi.fn().mockResolvedValue([]),
    prefetchEventRegistrations: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockAuthProfile ? { uid: mockAuthProfile.uid, email: mockAuthProfile.email } : null,
    userProfile: mockAuthProfile,
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const getAbility = () => defineAbilityFor(mockAuthProfile);

const MOCK_EVENTS = [
  {
    id: 'event-1',
    title: 'GDG Davao DevFest 2026',
    description: 'Annual flagship developer conference in Davao City.',
    shortDescription: 'Flagship conference',
    category: 'Conference',
    status: 'published',
    registrationStatus: 'open',
    startDate: new Date('2026-11-20T08:00:00Z'),
    endDate: new Date('2026-11-20T17:00:00Z'),
    venue: { type: 'in-person', name: 'SMX Convention Center', city: 'Davao City' },
    ticketTypes: [{ name: 'Regular', price: 0, currency: 'PHP' }],
    currentAttendees: 150,
    maxAttendees: 300,
    tags: ['AI', 'Cloud'],
  },
];

describe('EventListPage - Dedicated Card Grid View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderEventListPage = () =>
    render(
      <MemoryRouter initialEntries={['/events']}>
        <AbilityProvider value={getAbility()}>
          <EventListPage />
        </AbilityProvider>
      </MemoryRouter>
    );

  it('renders the card grid and does NOT display a list view toggle or table', async () => {
    mockAuthProfile = {
      uid: 'admin-1',
      email: 'admin@gdgdavao.org',
      role: 'admin',
      isActive: true,
      displayName: 'Admin User',
    };
    vi.mocked(EventService.getAllEvents).mockResolvedValueOnce(MOCK_EVENTS as any);

    renderEventListPage();

    // Event title renders in card grid
    expect(await screen.findByText('GDG Davao DevFest 2026')).toBeInTheDocument();

    // Verify view toggle buttons are completely removed
    expect(screen.queryByTitle('List view')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Grid view')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('List view')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Grid view')).not.toBeInTheDocument();

    // Verify no desktop table is rendered
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Verify Manage Event button has 48px touch target floor
    const manageLink = screen.getByRole('link', { name: /manage event/i });
    expect(manageLink).toHaveClass('min-h-[48px]');

    // Verify Share button has 48px touch floor
    const shareButton = screen.getByRole('button', { name: /share registration link/i });
    expect(shareButton).toHaveClass('min-h-[48px]');
    expect(shareButton).toHaveClass('min-w-[48px]');
  });

  it('renders EmptyState primitive when no events match or exist', async () => {
    mockAuthProfile = {
      uid: 'admin-1',
      email: 'admin@gdgdavao.org',
      role: 'admin',
      isActive: true,
      displayName: 'Admin User',
    };
    vi.mocked(EventService.getAllEvents).mockResolvedValueOnce([]);

    renderEventListPage();

    expect(await screen.findByText('No events found')).toBeInTheDocument();
    expect(screen.getByText('Get started by creating your first event.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /create event/i })).toHaveLength(2);
  });

  it('loads events for an organizer and renders Manage Event for all communal events', async () => {
    mockAuthProfile = {
      uid: 'org-1',
      email: 'jane@gdgdavao.org',
      role: 'organizer',
      isActive: true,
      displayName: 'Jane Organizer',
    };

    const firstEvent = {
      id: 'event-1',
      slug: 'jane-workshop',
      title: 'Jane Workshop 2026',
      status: 'draft',
      startDate: new Date('2026-11-20T08:00:00Z'),
      ticketTypes: [],
      currentAttendees: 10,
    };

    const secondEvent = {
      id: 'event-2',
      slug: 'community-summit',
      title: 'Community Summit 2026',
      status: 'published',
      startDate: new Date('2026-12-01T08:00:00Z'),
      ticketTypes: [],
      currentAttendees: 50,
    };

    vi.mocked(EventService.getAllEvents).mockResolvedValueOnce([firstEvent as any, secondEvent as any]);

    renderEventListPage();

    // Both events should render in the list
    expect(await screen.findByText('Jane Workshop 2026')).toBeInTheDocument();
    expect(screen.getByText('Community Summit 2026')).toBeInTheDocument();

    // In the communal model, all events render "Manage Event" pointing to /events/:id
    const manageLinks = screen.getAllByRole('link', { name: /manage event/i });
    expect(manageLinks).toHaveLength(2);
    expect(manageLinks[0]).toHaveAttribute('href', '/events/event-2');
    expect(manageLinks[1]).toHaveAttribute('href', '/events/event-1');

    // No ownership pills or ownership filter
    expect(screen.queryByText('Your event')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/filter events by ownership/i)).not.toBeInTheDocument();
  });
});

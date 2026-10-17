import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PaymentPage from '@/pages/payment/PaymentPage';
import FeedbackPage from '@/pages/feedback/FeedbackPage';

// Mock Services
vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    getRegistrationByPaymentToken: vi.fn(),
    getRegistrationById: vi.fn(),
  },
}));

vi.mock('@/services/paymentService', () => ({
  PaymentService: {
    getLatestPaymentProofByRegistrationId: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/eventService', () => ({
  EventService: {
    getEvent: vi.fn(),
    getFeedbackForm: vi.fn().mockResolvedValue({ fields: [] }),
  },
}));

vi.mock('@/services/feedbackService', () => ({
  FeedbackService: {
    resolveFeedbackToken: vi.fn(),
    submitFeedback: vi.fn(),
  },
}));

vi.mock('@/services/certificateService', () => ({
  CertificateService: {
    getTemplateForEvent: vi.fn().mockResolvedValue(null),
    getCertificateByRegistrationId: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: null,
    userProfile: null,
    loading: false,
  }),
}));

describe('Deep Link Routing Security & Access Hardening DOM tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Payment Deep Links (/payment/:registrationId)', () => {
    it('fails closed when accessed without ?t= authorization token', async () => {
      render(
        <MemoryRouter initialEntries={['/payment/reg-permanent-123']}>
          <Routes>
            <Route path="/payment/:registrationId" element={<PaymentPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Should display the restricted access EmptyState card
      expect(await screen.findByText('Payment Access Restricted')).toBeInTheDocument();
      expect(
        screen.getByText(/A valid payment authorization token is required/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Return to Home/i })).toBeInTheDocument();
    });
  });

  describe('Feedback Deep Links (/feedback/:eventId)', () => {
    it('ignores spoofed legacy query parameters and renders general feedback notice', async () => {
      const { EventService } = await import('@/services/eventService');
      vi.mocked(EventService.getEvent).mockResolvedValueOnce({
        id: 'evt-123',
        slug: 'test-event',
        title: 'Tech Summit 2026',
        description: 'Summit details',
        startDate: new Date('2026-11-20T09:00:00Z'),
        endDate: new Date('2026-11-20T17:00:00Z'),
        status: 'completed',
        isPublished: true,
        organizer: { uid: 'org-1', name: 'GDG', email: 'org@gdg.org' },
        venue: { type: 'physical', name: 'Hall A' },
      } as any);

      // Malicious URL attempting to spoof attendee identity
      render(
        <MemoryRouter
          initialEntries={[
            '/feedback/evt-123?registrationId=victim-reg-123&email=victim@example.com&name=AttackerSpoof',
          ]}
        >
          <Routes>
            <Route path="/feedback/:eventId" element={<FeedbackPage />} />
          </Routes>
        </MemoryRouter>
      );

      // The spoofed name MUST NOT be displayed in greeting
      expect(await screen.findByText(/Share Your Feedback/i)).toBeInTheDocument();
      expect(screen.queryByText(/Hi AttackerSpoof/i)).not.toBeInTheDocument();

      // The anonymous notice MUST be displayed informing attendee that certificates require email tokens
      expect(screen.getByText(/Submitting General Feedback/i)).toBeInTheDocument();
      expect(
        screen.getByText(/You are submitting feedback anonymously/i)
      ).toBeInTheDocument();
    });

    it('resolves verified token and displays personalized attendee greeting', async () => {
      const { EventService } = await import('@/services/eventService');
      const { FeedbackService } = await import('@/services/feedbackService');

      vi.mocked(EventService.getEvent).mockResolvedValueOnce({
        id: 'evt-123',
        slug: 'test-event',
        title: 'Tech Summit 2026',
        description: 'Summit details',
        startDate: new Date('2026-11-20T09:00:00Z'),
        endDate: new Date('2026-11-20T17:00:00Z'),
        status: 'completed',
        isPublished: true,
        organizer: { uid: 'org-1', name: 'GDG', email: 'org@gdg.org' },
        venue: { type: 'physical', name: 'Hall A' },
      } as any);

      vi.mocked(FeedbackService.resolveFeedbackToken).mockResolvedValueOnce({
        registrationId: 'reg-valid-123',
        email: 'alice@example.com',
        name: 'Alice Johnson',
        eventId: 'evt-123',
      });

      render(
        <MemoryRouter initialEntries={['/feedback/evt-123?token=valid-secret-token-xyz']}>
          <Routes>
            <Route path="/feedback/:eventId" element={<FeedbackPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Personalized greeting should be visible
      expect(await screen.findByText(/Hi Alice! Thanks for attending./i)).toBeInTheDocument();

      // Anonymous notice should NOT be shown
      expect(screen.queryByText(/Submitting General Feedback/i)).not.toBeInTheDocument();
    });
  });
});

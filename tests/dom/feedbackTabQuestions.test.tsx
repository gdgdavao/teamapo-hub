import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FeedbackTab from '@/pages/events/workspace/tabs/FeedbackTab';

const EVENT_ID = 'evt_feedback_test';

const getEvent = vi.fn();
const getEventFeedback = vi.fn();
const getFeedbackForm = vi.fn();
const updateFeedbackForm = vi.fn();

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
  functions: {},
}));

vi.mock('@/services/eventService', () => ({
  EventService: {
    getEvent: (...args: unknown[]) => getEvent(...args),
    getFeedbackForm: (...args: unknown[]) => getFeedbackForm(...args),
  },
}));

vi.mock('@/services/feedbackService', () => ({
  FeedbackService: {
    getEventFeedback: (...args: unknown[]) => getEventFeedback(...args),
    updateFeedbackForm: (...args: unknown[]) => updateFeedbackForm(...args),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: null,
    userProfile: { uid: 'organizer-1', role: 'organizer' },
    loading: false,
  }),
}));

const MOCK_EVENT = {
  id: EVENT_ID,
  title: 'Cloud Summit Davao',
  startDate: { toDate: () => new Date('2026-10-25') },
  currentAttendees: 150,
  organizerUid: 'organizer-1',
};

describe('FeedbackTab Form Questions & Locking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEvent.mockResolvedValue(MOCK_EVENT);
  });

  it('opens Form Questions editor when 0 feedback responses exist and enables editing', async () => {
    getEventFeedback.mockResolvedValue([]);
    getFeedbackForm.mockResolvedValue({ fields: [] });
    updateFeedbackForm.mockResolvedValue(undefined);

    render(<FeedbackTab eventId={EVENT_ID} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /configure form questions/i })).toBeInTheDocument();
    });

    // Click button to open editor
    const openEditorBtn = screen.getByRole('button', { name: /configure form questions/i });
    await userEvent.click(openEditorBtn);

    // Form Questions should display empty state when 0 questions configured
    expect(screen.getByText('No feedback questions configured yet')).toBeInTheDocument();
    expect(screen.getByText('Load GDG Starter Template')).toBeInTheDocument();

    // Click starter template loader
    const loadBtn = screen.getByText('Load GDG Starter Template');
    await userEvent.click(loadBtn);

    // Starter template questions should appear
    await waitFor(() => {
      expect(screen.getByDisplayValue('Overall Event Rating')).toBeInTheDocument();
    });

    // Save button should call updateFeedbackForm
    const saveBtn = screen.getByRole('button', { name: /save feedback form/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateFeedbackForm).toHaveBeenCalledWith(
        EVENT_ID,
        expect.arrayContaining([
          expect.objectContaining({ label: 'Overall Event Rating' }),
        ])
      );
    });
  });

  it('defaults to Summary tab and locks Form Questions when responses already exist', async () => {
    getEventFeedback.mockResolvedValue([
      {
        id: 'fb_1',
        overallRating: 5,
        responses: { overall_rating: 5 },
        submittedAt: { toDate: () => new Date() },
      },
    ]);
    getFeedbackForm.mockResolvedValue({
      fields: [
        { id: '1', type: 'rating', label: 'Overall Event Rating', required: true },
      ],
    });

    render(<FeedbackTab eventId={EVENT_ID} />);

    // When responses exist, Summary is the active tab by default
    await waitFor(() => {
      expect(screen.getByText('1 responses')).toBeInTheDocument();
    });

    // Switch to Form Questions tab
    const questionsTabBtn = screen.getByRole('button', { name: /form questions/i });
    await userEvent.click(questionsTabBtn);

    // Should display locked notice banner and Read Only badge
    await waitFor(() => {
      expect(screen.getByText('Feedback Form Locked')).toBeInTheDocument();
      expect(screen.getByText('Read Only')).toBeInTheDocument();
    });

    // Should display active question in read-only format
    expect(screen.getByText('Overall Event Rating')).toBeInTheDocument();

    // Edit and save actions should not be present in locked state
    expect(screen.queryByText('Save Questions')).not.toBeInTheDocument();
    expect(screen.queryByText('Save Feedback Form')).not.toBeInTheDocument();
  });
});

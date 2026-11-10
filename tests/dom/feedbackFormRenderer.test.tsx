import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FormRenderer from '@/pages/feedback/components/FormRenderer';
import FeedbackTab from '@/pages/events/workspace/tabs/FeedbackTab';
import { FormField } from '@/types';

const getEvent = vi.fn();
const getEventFeedback = vi.fn();
const getFeedbackForm = vi.fn();

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
    updateFeedbackForm: vi.fn(),
  },
}));

const DEVFEST_2026_FEEDBACK_FIELDS: FormField[] = [
  {
    id: 'overall_rating',
    type: 'rating',
    label: 'Overall Event Rating',
    required: true,
    gridSize: 'full',
  },
  {
    id: 'field_1794293259393_51am9',
    type: 'spacer',
    label: 'Section Divider',
    required: false,
    gridSize: 'full',
  },
  {
    id: 'field_1794293264026_dxiw8',
    type: 'radio',
    label: 'How likely are you to recommend this event to a friend or colleague?',
    required: true,
    gridSize: 'full',
    options: ['Definitely', 'Probably', 'Not Sure', 'Probably Not', 'Definitely Not', 'Other...'],
  },
  {
    id: 'field_1794293446777_ldd6r',
    type: 'text',
    label: 'What was one key takeaway or something new you learned today?',
    required: true,
    gridSize: 'full',
  },
  {
    id: 'field_1794293465710_e3sl0',
    type: 'checkbox',
    label: 'How has attending GDG events impacted you?',
    required: true,
    gridSize: 'full',
    options: [
      'Connected with other developers',
      'Learned new technical skills',
      'Inspired to build a project',
      'Other...',
    ],
  },
  {
    id: 'field_1794293501211_tsjif',
    type: 'spacer',
    label: 'Section Divider',
    required: true,
    gridSize: 'full',
  },
  {
    id: 'liked_most',
    type: 'textarea',
    label: 'What did you like most?',
    required: false,
    gridSize: 'full',
  },
];

describe('FormRenderer — DevFest Davao 2026 Custom Feedback Template', () => {
  it('renders multi-option checkbox fields, supports "Other..." write-ins, ignores required spacers, and has no orphan <label for>', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <FormRenderer
        fields={DEVFEST_2026_FEEDBACK_FIELDS}
        onSubmit={onSubmit}
        submitButtonText="Submit Feedback"
      />
    );

    // Every <label for="..."> must point to an existing element id in the document
    const labelsWithFor = Array.from(container.querySelectorAll('label[for]'));
    expect(labelsWithFor.length).toBeGreaterThan(0);
    for (const labelEl of labelsWithFor) {
      const targetId = labelEl.getAttribute('for');
      expect(targetId).toBeTruthy();
      expect(container.querySelector(`#${CSS.escape(targetId!)}`)).not.toBeNull();
    }

    // All 4 options of the multi-option checkbox field (Question 5) are rendered
    expect(screen.getByLabelText('Connected with other developers')).toBeInTheDocument();
    expect(screen.getByLabelText('Learned new technical skills')).toBeInTheDocument();
    expect(screen.getByLabelText('Inspired to build a project')).toBeInTheDocument();

    // Attempt submit while empty -> required validation errors trigger, but NOT for spacer fields
    await userEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('How has attending GDG events impacted you? is required')).toBeInTheDocument();
    expect(screen.queryByText('Section Divider is required')).not.toBeInTheDocument();

    // Fill out required fields
    await userEvent.click(screen.getByRole('radio', { name: /5 stars/i }));
    await userEvent.click(screen.getByLabelText('Definitely'));
    await userEvent.type(
      screen.getByLabelText(/What was one key takeaway/i),
      'Learned Vertex AI agent patterns'
    );

    // Select regular checkbox option + "Other:" option on Question 5
    await userEvent.click(screen.getByLabelText('Learned new technical skills'));
    const checkboxOtherInputs = screen.getAllByLabelText('Other:');
    await userEvent.click(checkboxOtherInputs[1]); // Question 5's "Other:" checkbox

    // Submitting with blank "Other..." on a required checkbox group asks to specify
    await userEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Please specify your answer for How has attending GDG events impacted you\?/i)
    ).toBeInTheDocument();

    // Type custom "Other" text and submit
    const specifyInput = screen.getByLabelText('Please specify for Other...');
    await userEvent.type(specifyInput, 'Found a hackathon team');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        overall_rating: 5,
        field_1794293264026_dxiw8: 'Definitely',
        field_1794293446777_ldd6r: 'Learned Vertex AI agent patterns',
        field_1794293465710_e3sl0: [
          'Learned new technical skills',
          'Other: Found a hackathon team',
        ],
      })
    );
  });
});

describe('FeedbackTab — Multi-option Checkbox Aggregation & Spacer Exclusion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEvent.mockResolvedValue({
      id: 'c6dzpNS14RxTer8F8Ppd',
      title: 'DevFest Davao 2026',
      startDate: { toDate: () => new Date('2026-11-08') },
      currentAttendees: 292,
    });
  });

  it('aggregates multi-option checkbox responses by option (including "Other: ..." write-ins) and skips spacers', async () => {
    getFeedbackForm.mockResolvedValue({
      fields: DEVFEST_2026_FEEDBACK_FIELDS,
    });
    getEventFeedback.mockResolvedValue([
      {
        id: 'fb_1',
        overallRating: 5,
        customResponses: {
          overall_rating: 5,
          field_1794293264026_dxiw8: 'Other: 100% yes',
          field_1794293446777_ldd6r: 'Cloud Functions v2',
          field_1794293465710_e3sl0: [
            'Connected with other developers',
            'Other: Mentored students',
          ],
        },
        submittedAt: { toDate: () => new Date('2026-11-09T10:00:00Z') },
      },
    ]);

    render(<FeedbackTab eventId="c6dzpNS14RxTer8F8Ppd" />);

    await waitFor(() => {
      expect(screen.getByText('How has attending GDG events impacted you?')).toBeInTheDocument();
    });

    // Spacer labels should never appear as question cards in Summary
    expect(screen.queryByText('Section Divider')).not.toBeInTheDocument();

    // Multi-option checkbox options appear in the Summary breakdown
    expect(screen.getByText('Connected with other developers')).toBeInTheDocument();
    expect(screen.getByText('Learned new technical skills')).toBeInTheDocument();
  });
});

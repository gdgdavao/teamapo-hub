import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

const { getEventMock, getEventRegistrationFormMock, getEventRegistrationsMock } = vi.hoisted(() => ({
  getEventMock: vi.fn(),
  getEventRegistrationFormMock: vi.fn(),
  getEventRegistrationsMock: vi.fn(),
}));

vi.mock('../../src/services/eventService', () => ({
  EventService: {
    getEvent: getEventMock,
    getEventRegistrationForm: getEventRegistrationFormMock,
  },
}));

vi.mock('../../src/services/registrationService', () => ({
  RegistrationService: {
    getEventRegistrations: getEventRegistrationsMock,
  },
}));

import ResponsesTab from '../../src/pages/events/workspace/tabs/ResponsesTab';

describe('ResponsesTab DOM (R2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getEventMock.mockResolvedValue({
      id: 'evt-1',
      title: 'GDG Davao Cloud Next Extended',
      ticketTypes: [{ id: 'ga', name: 'General Admission' }],
      registrationForm: [
        {
          id: 'org',
          type: 'select',
          label: 'Organization Type',
          required: true,
          options: ['University', 'Startup', 'Enterprise'],
        },
        {
          id: 'track',
          type: 'radio',
          label: 'Preferred Track',
          required: true,
          options: ['AI & ML', 'Cloud Native'],
        },
      ],
    });

    getEventRegistrationFormMock.mockResolvedValue([]);

    getEventRegistrationsMock.mockResolvedValue([
      {
        id: 'reg-1',
        attendanceStatus: 'checked-in',
        ticketTypeId: 'ga',
        userDetails: { name: 'Maria Clara', email: 'maria@davao.dev' },
        customResponses: {
          org: 'University',
          track: 'AI & ML',
          legacyNote: 'Dietary: Halal',
        },
      },
      {
        id: 'reg-2',
        attendanceStatus: 'registered',
        ticketTypeId: 'ga',
        userDetails: { name: 'Jose Rizal', email: 'jose@davao.dev' },
        customResponses: {
          org: 'Startup',
          track: 'Cloud Native',
        },
      },
    ]);
  });

  it('renders Questions view by default, switches to Group view and re-aggregates, and expands Individual view', async () => {
    const user = userEvent.setup();
    render(<ResponsesTab eventId="evt-1" />);

    await waitFor(() => {
      expect(screen.getByText('Registration Form Responses')).toBeInTheDocument();
    });

    expect(screen.getByText('2 respondents')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Responses by question' })).toBeInTheDocument();
    expect(screen.getByText('Organization Type')).toBeInTheDocument();
    expect(screen.getByText('Preferred Track')).toBeInTheDocument();
    expect(screen.getByText(/Orphaned Responses \(1\)/)).toBeInTheDocument();

    // Switch to Group sub-view
    await user.click(screen.getByRole('radio', { name: 'Group' }));
    expect(screen.getByRole('region', { name: 'Grouped responses' })).toBeInTheDocument();
    expect(screen.getByLabelText('Group: University')).toBeInTheDocument();
    expect(screen.getByLabelText('Group: Startup')).toBeInTheDocument();

    // Switch Group-by selector to Preferred Track
    const groupSelect = screen.getByLabelText('Group responses by question');
    await user.selectOptions(groupSelect, 'track');
    expect(screen.getByLabelText('Group: AI & ML')).toBeInTheDocument();
    expect(screen.getByLabelText('Group: Cloud Native')).toBeInTheDocument();

    // Switch to Individual sub-view
    await user.click(screen.getByRole('radio', { name: 'Individual' }));
    expect(screen.getByRole('region', { name: 'Individual respondent submissions' })).toBeInTheDocument();
    expect(screen.getByText('Maria Clara')).toBeInTheDocument();
    expect(screen.getByText('Jose Rizal')).toBeInTheDocument();

    // Expand Maria Clara's individual submission
    const viewButtons = screen.getAllByRole('button', { name: /Maria Clara/i });
    await user.click(viewButtons[0]);
    expect(screen.getByText('Dietary: Halal')).toBeInTheDocument();
  });
});

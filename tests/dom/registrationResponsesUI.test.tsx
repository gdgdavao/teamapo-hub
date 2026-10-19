import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityProvider } from '@casl/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RegistrationDetailsModal } from '@/pages/events/workspace/tabs/RegistrationDetailsModal';
import { defineAbilityFor } from '@/auth/ability';
import toast from 'react-hot-toast';

const ADMIN = defineAbilityFor({ uid: 'admin-1', role: 'admin', isActive: true });

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    updateRegistrationStatus: vi.fn(),
    updateAttendeeDetails: vi.fn(),
  },
}));

vi.mock('@/services/emailService', () => ({
  EmailService: {
    getAttendeeEmails: vi.fn().mockResolvedValue([]),
    resendEmail: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const noop = vi.fn();

const longFormFields = [
  { id: 'name', label: 'Full Name', type: 'text' as const },
  { id: 'email', label: 'Email Address', type: 'email' as const },
  { id: 'phone', label: 'Phone Number', type: 'phone' as const },
  { id: 'org', label: 'Organization / Company', type: 'text' as const },
  { id: 'role', label: 'Current Role / Title', type: 'text' as const },
  { id: 'shirt', label: 'T-Shirt Size', type: 'select' as const },
  { id: 'diet', label: 'Dietary Restrictions', type: 'text' as const },
  { id: 'experience', label: 'Years of Experience', type: 'number' as const },
  { id: 'emergency_contact', label: 'Emergency Contact Person', type: 'text' as const },
  { id: 'github', label: 'GitHub Profile URL', type: 'url' as const },
];

const mockEvent = {
  id: 'evt_1',
  title: 'DevFest Davao 2026',
  date: '2026-11-20',
  venue: 'SMX Convention Center',
  ticketPrice: 0,
  organizer: { uid: 'admin-1', name: 'GDG Davao' },
  registrationForm: longFormFields,
};

const mockRegistration = {
  id: 'reg_100',
  attendee: {
    id: 'att_100',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '09123456789',
    organization: 'Analytical Engine Inc.',
  },
  event: {
    id: 'evt_1',
    title: 'DevFest Davao 2026',
    date: '2026-11-20',
    venue: 'SMX Convention Center',
    ticketPrice: 0,
  },
  status: 'pending' as const,
  registrationDate: '2026-10-15',
  formSubmission: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '09123456789',
    org: 'Analytical Engine Inc.',
    role: 'Lead Mathematician',
    shirt: 'Medium',
    diet: 'Vegetarian',
    experience: 12,
    emergency_contact: '', // Unanswered
    github: 'https://github.com/adalovelace',
  },
};

describe('RegistrationDetailsModal — Registration Responses UI/UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (reg = mockRegistration, evt = mockEvent) =>
    render(
      <AbilityProvider value={ADMIN}>
        <RegistrationDetailsModal
          isOpen
          onClose={noop}
          registration={reg as never}
          events={[evt] as never[]}
          onUpdateRegistration={noop}
          onStatusChange={noop}
          onPaymentVerification={noop}
          onDeleteRegistration={noop}
        />
      </AbilityProvider>
    );

  it('renders answered metrics and copy all button in header', () => {
    renderModal();

    expect(screen.getByText('Registration Responses')).toBeInTheDocument();
    // 9 answered out of 10 fields (emergency_contact is empty)
    expect(screen.getByText('(9/10 answered)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy all/i })).toBeInTheDocument();
  });

  it('collapses long forms (>6 fields) with progressive disclosure toggle', async () => {
    const user = userEvent.setup();
    renderModal();

    // First 6 fields should be visible
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('T-Shirt Size')).toBeInTheDocument();

    // 7th field onwards should initially not be visible because it is sliced to top 6
    expect(screen.queryByText('Dietary Restrictions')).not.toBeInTheDocument();
    expect(screen.queryByText('GitHub Profile URL')).not.toBeInTheDocument();

    // Expand toggle button should exist
    const expandButton = screen.getByRole('button', {
      name: /view all 10 responses/i,
    });
    expect(expandButton).toBeInTheDocument();

    // Click to expand
    await user.click(expandButton);

    // Now remaining fields should be visible
    expect(screen.getByText('Dietary Restrictions')).toBeInTheDocument();
    expect(screen.getByText('GitHub Profile URL')).toBeInTheDocument();

    // Show Less toggle should now be visible
    const showLessButton = screen.getByRole('button', { name: /show less/i });
    expect(showLessButton).toBeInTheDocument();

    // Click Show Less
    await user.click(showLessButton);
    expect(screen.queryByText('Dietary Restrictions')).not.toBeInTheDocument();
  });

  it('supports instant search filtering by question label and answer value', async () => {
    const user = userEvent.setup();
    renderModal();

    const searchInput = screen.getByPlaceholderText(/search questions or answers/i);
    expect(searchInput).toBeInTheDocument();

    // Search for "Vegetarian" (matches answer)
    await user.type(searchInput, 'Vegetarian');

    // Should auto-expand and show the matching field
    expect(screen.getByText('Dietary Restrictions')).toBeInTheDocument();
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
    expect(screen.queryByText('T-Shirt Size')).not.toBeInTheDocument();

    // Clear search
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('filters by answered and unanswered chips', async () => {
    const user = userEvent.setup();
    renderModal();

    // Click "Unanswered" filter tab
    const unansweredTab = screen.getByRole('tab', { name: /unanswered/i });
    await user.click(unansweredTab);

    // Only emergency contact was empty in mock data
    expect(screen.getByText('Emergency Contact Person')).toBeInTheDocument();
    expect(screen.getByText('Not provided')).toBeInTheDocument();
    expect(screen.queryByText('T-Shirt Size')).not.toBeInTheDocument();

    // Switch back to "All"
    const allTab = screen.getByRole('tab', { name: /^all/i });
    await user.click(allTab);

    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('copies all responses to clipboard when clicking Copy All', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    renderModal();

    const copyAllBtn = screen.getByRole('button', { name: /copy all/i });
    await user.click(copyAllBtn);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const clipboardPayload = writeTextMock.mock.calls[0][0];

    expect(clipboardPayload).toContain('Registration Responses — Ada Lovelace');
    expect(clipboardPayload).toContain('• Full Name: Ada Lovelace');
    expect(clipboardPayload).toContain('• T-Shirt Size: Medium');
    expect(clipboardPayload).toContain('• Dietary Restrictions: Vegetarian');
    expect(clipboardPayload).toContain('• Emergency Contact Person: Not provided');

    expect(toast.success).toHaveBeenCalledWith('All responses copied to clipboard');
  });
});

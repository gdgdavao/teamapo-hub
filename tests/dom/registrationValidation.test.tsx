import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RegistrationForm from '@/pages/registration/components/RegistrationForm';
import { Event, FormField } from '@/types';

// Mock RegistrationService and EventService
vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    createPendingRegistration: vi.fn(),
    sendRegistrationConfirmationEmail: vi.fn(),
  },
}));

vi.mock('@/services/eventService', () => ({
  EventService: {
    getEvent: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('RegistrationForm Validation & Accessibility DOM tests', () => {
  const mockEvent: Event = {
    id: 'evt-test-123',
    slug: 'test-event-2026',
    title: 'Test Tech Conference',
    description: 'A great test event',
    startDate: new Date('2026-11-20T09:00:00Z'),
    endDate: new Date('2026-11-20T17:00:00Z'),
    status: 'published',
    isPublished: true,
    organizer: {
      uid: 'org-123',
      name: 'GDG Davao',
      email: 'organizer@gdgdavao.org',
    },
    venue: {
      type: 'physical',
      name: 'Davao Convention Center',
      address: 'F. Torres St',
      city: 'Davao City',
    },
    ticketTypes: [
      {
        id: 'free-ticket',
        name: 'General Admission',
        description: 'Standard free entry',
        price: 0,
        currency: 'PHP',
        maxQuantity: 100,
        currentSold: 10,
        isActive: true,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ticket selection and prompts attendee to select a ticket', () => {
    render(
      <MemoryRouter>
        <RegistrationForm event={mockEvent} registrationForm={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText('Choose Your Ticket')).toBeInTheDocument();
    expect(screen.getByText('General Admission')).toBeInTheDocument();
  });

  it('validates email on blur and renders accessible alert', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RegistrationForm event={mockEvent} registrationForm={[]} />
      </MemoryRouter>
    );

    // Select the free ticket
    const ticketRadio = screen.getByRole('radio', { name: /General Admission/i });
    await user.click(ticketRadio);

    // Form inputs should now be visible
    const emailInput = screen.getByLabelText(/Email Address/i);
    expect(emailInput).toBeInTheDocument();

    // Type invalid email and blur
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // triggers blur

    // An accessible alert must appear
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Please enter a valid email address/i);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');

    // Fix the email
    await user.clear(emailInput);
    await user.type(emailInput, 'valid.attendee@example.com');

    // Error should clear
    expect(screen.queryByText(/Please enter a valid email address/i)).not.toBeInTheDocument();
  });

  it('validates required fields on submit and displays inline errors', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <RegistrationForm event={mockEvent} registrationForm={[]} />
      </MemoryRouter>
    );

    // Select ticket
    await user.click(screen.getByRole('radio', { name: /General Admission/i }));

    // Click submit with empty fields
    const submitBtn = screen.getByRole('button', { name: /Complete Registration/i });
    await user.click(submitBtn);

    // Both name and email errors should appear as role="alert"
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Full name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Email address is required/i)).toBeInTheDocument();
  });

  it('supports custom dynamic form fields and validates them', async () => {
    const user = userEvent.setup();
    const customFields: FormField[] = [
      {
        id: 'full_name',
        label: 'Attendee Full Name',
        type: 'text',
        required: true,
      },
      {
        id: 'attendee_email',
        label: 'Attendee Email Address',
        type: 'email',
        required: true,
      },
      {
        id: 'tshirt_size',
        label: 'T-Shirt Size',
        type: 'select',
        required: true,
        options: ['S', 'M', 'L', 'XL'],
      },
    ];

    render(
      <MemoryRouter>
        <RegistrationForm event={mockEvent} registrationForm={customFields} />
      </MemoryRouter>
    );

    // Select ticket
    await user.click(screen.getByRole('radio', { name: /General Admission/i }));

    // Custom fields rendered
    expect(screen.getByLabelText(/Attendee Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Attendee Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/T-Shirt Size/i)).toBeInTheDocument();

    // Submit empty
    await user.click(screen.getByRole('button', { name: /Complete Registration/i }));

    expect(screen.getByText(/T-Shirt Size is required/i)).toBeInTheDocument();
  });

  it('guarantees contact fields when custom form omits email', async () => {
    const user = userEvent.setup();
    const customFieldsWithoutEmail: FormField[] = [
      {
        id: 'company_name',
        label: 'Company / Organization',
        type: 'text',
        required: true,
      },
    ];

    render(
      <MemoryRouter>
        <RegistrationForm event={mockEvent} registrationForm={customFieldsWithoutEmail} />
      </MemoryRouter>
    );

    // Select ticket
    await user.click(screen.getByRole('radio', { name: /General Admission/i }));

    // Guaranteed contact information section rendered
    expect(screen.getByText(/Contact Information/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Company \/ Organization/i)).toBeInTheDocument();
  });

  it('displays inline error and toast when backend rejects duplicate registration email', async () => {
    const user = userEvent.setup();
    const { RegistrationService } = await import('@/services/registrationService');
    const toast = (await import('react-hot-toast')).default;

    vi.mocked(RegistrationService.createPendingRegistration).mockRejectedValueOnce(
      new Error('You are already registered for this event with this email address.')
    );

    render(
      <MemoryRouter>
        <RegistrationForm event={mockEvent} registrationForm={[]} />
      </MemoryRouter>
    );

    // Select ticket
    await user.click(screen.getByRole('radio', { name: /General Admission/i }));

    // Fill valid name and email
    await user.type(screen.getByLabelText(/Full Name/i), 'Maria Santos');
    await user.type(screen.getByLabelText(/Email Address/i), 'maria.santos@gdgdavao.org');

    // Submit
    await user.click(screen.getByRole('button', { name: /Complete Registration/i }));

    // Inline field error displayed
    expect(
      await screen.findByText(/You are already registered for this event with this email address/i)
    ).toBeInTheDocument();

    // Toast guidance shown
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('already registered for this event'),
      expect.anything()
    );
  });

  it('does NOT render duplicate Full Name input when custom form has First Name and Last Name fields', async () => {
    const user = userEvent.setup();
    const { RegistrationService } = await import('@/services/registrationService');
    vi.mocked(RegistrationService.createPendingRegistration).mockResolvedValueOnce({
      registrationId: 'reg-new-123',
      pricing: {} as any,
      qrCode: 'qr-123',
      requiresPayment: false,
    });

    const splitNameFields: FormField[] = [
      {
        id: 'first_name',
        label: 'First Name',
        type: 'text',
        required: true,
      },
      {
        id: 'last_name',
        label: 'Last Name',
        type: 'text',
        required: true,
      },
      {
        id: 'email_address',
        label: 'Email',
        type: 'email',
        required: true,
      },
    ];

    render(
      <MemoryRouter>
        <RegistrationForm event={mockEvent} registrationForm={splitNameFields} />
      </MemoryRouter>
    );

    // Select ticket
    await user.click(screen.getByRole('radio', { name: /General Admission/i }));

    // Verify First Name and Last Name are rendered
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();

    // Verify Contact Information and duplicate "Full Name" input are NOT rendered
    expect(screen.queryByText('Contact Information')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Full Name/i)).not.toBeInTheDocument();

    // Fill form and submit
    await user.type(screen.getByLabelText(/First Name/i), 'Juan');
    await user.type(screen.getByLabelText(/Last Name/i), 'Dela Cruz');
    await user.type(screen.getByLabelText(/Email/i), 'juan@gdgdavao.org');

    await user.click(screen.getByRole('button', { name: /Complete Registration/i }));

    // Ensure registration was submitted with combined full name
    expect(RegistrationService.createPendingRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        userDetails: expect.objectContaining({
          name: 'Juan Dela Cruz',
          email: 'juan@gdgdavao.org',
        }),
      })
    );
  });
});


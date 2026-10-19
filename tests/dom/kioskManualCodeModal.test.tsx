import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  KioskManualCodeModal,
  normalizeLookupCode,
  detectInputType,
} from '../../src/pages/events/kiosk/KioskManualCodeModal';

describe('normalizeLookupCode & detectInputType pure helpers', () => {
  it('normalizes leading/trailing whitespace', () => {
    expect(normalizeLookupCode('   REG-12345   ')).toBe('REG-12345');
    expect(normalizeLookupCode('')).toBe('');
  });

  it('strips registration: scanner namespace prefix', () => {
    expect(normalizeLookupCode('registration:user_abc123')).toBe('user_abc123');
  });

  it('auto-uppercases ticket code prefix starting with reg-', () => {
    expect(normalizeLookupCode('reg-99182')).toBe('REG-99182');
    expect(normalizeLookupCode('reg_ticket_1')).toBe('REG_TICKET_1');
  });

  it('extracts code from URL if a full link was pasted', () => {
    expect(normalizeLookupCode('https://apohub.app/verify?code=REG-552')).toBe('REG-552');
    expect(normalizeLookupCode('http://localhost:5173/verify/REG-771')).toBe('REG-771');
  });

  it('correctly detects input types', () => {
    expect(detectInputType('')).toBeNull();
    expect(detectInputType('attendee@gdgdavao.org')).toBe('email');
    expect(detectInputType('100234567891')).toBe('payment');
    expect(detectInputType('REG-88219')).toBe('code');
    expect(detectInputType('reg-992')).toBe('code');
  });
});

describe('KioskManualCodeModal Component (DOM)', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title, format chips, and disabled submit button when empty', () => {
    render(<KioskManualCodeModal {...defaultProps} />);

    expect(screen.getByText('Manual Check-In')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ticket code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email address/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /payment ref/i })).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    expect(submitBtn).toBeDisabled();
  });

  it('updates placeholder and effective mode when clicking format selector chips', () => {
    render(<KioskManualCodeModal {...defaultProps} />);

    const emailChip = screen.getByRole('button', { name: /email address/i });
    fireEvent.click(emailChip);

    const input = screen.getByPlaceholderText('e.g. attendee@gdgdavao.org');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('Verifying registration matching this registered email address.')).toBeInTheDocument();

    const paymentChip = screen.getByRole('button', { name: /payment ref/i });
    fireEvent.click(paymentChip);

    expect(screen.getByPlaceholderText('e.g. 100234567891 (GCash / Maya reference)')).toBeInTheDocument();
  });

  it('automatically detects email format as user types', async () => {
    render(<KioskManualCodeModal {...defaultProps} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'maria@example.com' } });

    await waitFor(() => {
      expect(screen.getByText('Email Detected')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    expect(submitBtn).toBeEnabled();
  });

  it('automatically detects ticket code format as user types', async () => {
    render(<KioskManualCodeModal {...defaultProps} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'REG-98765' } });

    await waitFor(() => {
      expect(screen.getByText('Ticket Code Detected')).toBeInTheDocument();
    });
  });

  it('automatically detects payment reference format as user types numbers', async () => {
    render(<KioskManualCodeModal {...defaultProps} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '100293848192' } });

    await waitFor(() => {
      expect(screen.getByText('Payment Ref Detected')).toBeInTheDocument();
    });
  });

  it('clears input and resets detection when clicking the Clear button', () => {
    render(<KioskManualCodeModal {...defaultProps} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'REG-12345' } });

    const clearBtn = screen.getByRole('button', { name: /clear input/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    expect(input).toHaveValue('');
    expect(screen.queryByText('Ticket Code Detected')).not.toBeInTheDocument();
  });

  it('calls onSubmit with normalized code on submit click', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<KioskManualCodeModal {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  reg-88312  ' } });

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith('REG-88312');
    });
  });

  it('displays specific error message returned by onSubmit in the alert banner', async () => {
    const onSubmit = vi.fn().mockResolvedValue('Attendee was already checked in.');
    render(<KioskManualCodeModal {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'REG-DUPLICATE' } });

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Attendee was already checked in.')).toBeInTheDocument();
    });

    // Typing in the input clears the error
    fireEvent.change(input, { target: { value: 'REG-NEW' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('displays default error message when onSubmit returns false', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(<KioskManualCodeModal {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'INVALID_CODE' } });

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Could not find a valid registration for this code or email. Please verify your details or ask staff.'
        )
      ).toBeInTheDocument();
    });
  });

  it('displays thrown exception message in the alert banner', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network connectivity issue.'));
    render(<KioskManualCodeModal {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'REG-ERR' } });

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Network connectivity issue.')).toBeInTheDocument();
    });
  });

  it('calls onClose when clicking Cancel button', () => {
    render(<KioskManualCodeModal {...defaultProps} />);

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});

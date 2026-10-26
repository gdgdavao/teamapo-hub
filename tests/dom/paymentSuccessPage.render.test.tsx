import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PaymentSuccessPage from '../../src/pages/payment/PaymentSuccessPage';
import { RegistrationService } from '../../src/services/registrationService';
import { WalletPassService } from '../../src/services/walletPassService';

describe('PaymentSuccessPage with TicketCard Integration', () => {
  const sampleTicketData = {
    registration: {
      id: 'reg_xyz789',
      qrCode: 'REG-1730000000-xyz-789',
      userDetails: {
        name: 'Juan John Dela Cruz',
        firstName: 'Juan John',
        lastName: 'Dela Cruz',
      },
    },
    event: {
      id: 'devfest-2025',
      title: 'DevFest 2025 Davao',
      startDate: '2025-09-21T02:00:00.000Z',
      timezone: 'Asia/Manila',
      venue: {
        name: 'SMX Convention Center',
        address: 'SM Lanang, Davao City',
      },
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders standard confirmation state without ticket when no reg/token params or state exist', () => {
    render(
      <MemoryRouter initialEntries={['/payment/success']}>
        <Routes>
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Registration Submitted')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Event ticket for/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Save to Google Wallet')).not.toBeInTheDocument();
  });

  it('fetches ticket pass and renders TicketCard and Save button when reg & token are provided', async () => {
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue(sampleTicketData);

    render(
      <MemoryRouter initialEntries={['/payment/success?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Juan John')).toBeInTheDocument();
      expect(screen.getByText('Dela Cruz')).toBeInTheDocument();
    });

    expect(screen.getByText('Participant • DevFest 2025 Davao')).toBeInTheDocument();
    expect(screen.getByText(/SMX Convention Center/)).toBeInTheDocument();
    expect(screen.getByText('09/21/2025 10:00AM')).toBeInTheDocument();

    // "Save to Google Wallet" button sits outside/below the card
    const saveBtn = screen.getByRole('button', { name: /Save to Google Wallet/i });
    expect(saveBtn).toBeInTheDocument();
  });

  it('invokes WalletPassService.createWalletPassUrl on clicking Save to Google Wallet', async () => {
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue(sampleTicketData);
    const createWalletSpy = vi.spyOn(WalletPassService, 'createWalletPassUrl').mockResolvedValue({
      saveUrl: 'https://pay.google.com/gp/v/save/mock-jwt-url',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MemoryRouter initialEntries={['/payment/success?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save to Google Wallet/i })).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /Save to Google Wallet/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(createWalletSpy).toHaveBeenCalledWith({
        registrationId: 'reg_xyz789',
        walletPassToken: 'pass_tok_123',
      });
      expect(openSpy).toHaveBeenCalledWith(
        'https://pay.google.com/gp/v/save/mock-jwt-url',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  it('renders TicketCard immediately when passed via location.state', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/registration/success',
            state: sampleTicketData,
          },
        ]}
      >
        <Routes>
          <Route path="/registration/success" element={<PaymentSuccessPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Registration Complete')).toBeInTheDocument();
    expect(screen.getByText('Juan John')).toBeInTheDocument();
    expect(screen.getByText('Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Participant • DevFest 2025 Davao')).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TicketPage from '../../src/pages/ticket/TicketPage';
import LegacyTicketRedirect from '../../src/pages/ticket/LegacyTicketRedirect';
import { RegistrationService } from '../../src/services/registrationService';
import { WalletPassService } from '../../src/services/walletPassService';
import * as TicketCanvasUtils from '../../src/utils/ticketCanvas';
import * as PassArtworkUtils from '../../src/utils/passArtwork';

describe('TicketPage with TicketCard, Google Wallet & Save as Image Integration', () => {
  const sampleTicketData = {
    registration: {
      id: 'reg_xyz789',
      qrCode: 'REG-1730000000-xyz-789',
      registrationStatus: 'approved',
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
      <MemoryRouter initialEntries={['/ticket']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Registration Submitted')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Event ticket for/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Save to Google Wallet')).not.toBeInTheDocument();
  });

  it('fetches ticket pass and renders TicketCard, Save to Google Wallet and Save as Image buttons', async () => {
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue(sampleTicketData);

    render(
      <MemoryRouter initialEntries={['/ticket?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
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

    // Both action buttons sit outside/below the card
    expect(screen.getByRole('button', { name: /Save to Google Wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save your ticket as an image/i })).toBeInTheDocument();
  });

  it('invokes WalletPassService.createWalletPassUrl on clicking Save to Google Wallet', async () => {
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue(sampleTicketData);
    const createWalletSpy = vi.spyOn(WalletPassService, 'createWalletPassUrl').mockResolvedValue({
      saveUrl: 'https://pay.google.com/gp/v/save/mock-jwt-url',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MemoryRouter initialEntries={['/ticket?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
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

  it('invokes downloadTicketAsPng on clicking Save as Image', async () => {
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue(sampleTicketData);
    const downloadSpy = vi.spyOn(TicketCanvasUtils, 'downloadTicketAsPng').mockResolvedValue(true);

    render(
      <MemoryRouter initialEntries={['/ticket?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save your ticket as an image/i })).toBeInTheDocument();
    });

    const imageBtn = screen.getByRole('button', { name: /Save your ticket as an image/i });
    fireEvent.click(imageBtn);

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationId: 'reg_xyz789',
          eventTitle: 'DevFest 2025 Davao',
        })
      );
    });
  });

  it('renders TicketCard immediately when passed via location.state in free mode', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/ticket',
            search: '?mode=free',
            state: sampleTicketData,
          },
        ]}
      >
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Registration Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Juan John')).toBeInTheDocument();
    expect(screen.getByText('Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Participant • DevFest 2025 Davao')).toBeInTheDocument();
  });

  it('legacy redirects forward from /payment/success and /registration/success to /ticket preserving query params', async () => {
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue(sampleTicketData);

    render(
      <MemoryRouter initialEntries={['/payment/success?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
          <Route path="/payment/success" element={<LegacyTicketRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Juan John')).toBeInTheDocument();
      expect(screen.getByText('Participant • DevFest 2025 Davao')).toBeInTheDocument();
    });
  });

  it('does NOT offer Save to Google Wallet on iOS devices while keeping Save as Image primary', async () => {
    vi.spyOn(PassArtworkUtils, 'isIOSDevice').mockReturnValue(true);
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue(sampleTicketData);

    render(
      <MemoryRouter initialEntries={['/ticket?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Juan John')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Save to Google Wallet/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save your ticket as an image/i })).toBeInTheDocument();
  });

  it('strictly hides TicketCard, QR code, and action buttons when getTicketPass fails with not-found or not-approved', async () => {
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue({ error: 'not-approved' });

    render(
      <MemoryRouter initialEntries={['/ticket?reg=reg_unapproved&token=tok_unapproved']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Ticket Pending Verification')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('qr-tile')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save to Google Wallet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save your ticket as an image/i })).not.toBeInTheDocument();
  });

  it('shows Retry button on network error and loads ticket on retry', async () => {
    const getPassSpy = vi
      .spyOn(RegistrationService, 'getTicketPass')
      .mockResolvedValueOnce({ error: 'error' })
      .mockResolvedValueOnce(sampleTicketData);

    render(
      <MemoryRouter initialEntries={['/ticket?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Ticket')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry Loading Ticket/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(getPassSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Juan John')).toBeInTheDocument();
    });
  });

  it('reuses cached saveUrl on subsequent clicks without re-calling createWalletPassUrl', async () => {
    vi.spyOn(RegistrationService, 'getTicketPass').mockResolvedValue(sampleTicketData);
    const createWalletSpy = vi.spyOn(WalletPassService, 'createWalletPassUrl').mockResolvedValue({
      saveUrl: 'https://pay.google.com/gp/v/save/mock-jwt-url',
      expiryAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({} as Window));

    render(
      <MemoryRouter initialEntries={['/ticket?reg=reg_xyz789&token=pass_tok_123']}>
        <Routes>
          <Route path="/ticket" element={<TicketPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save to Google Wallet/i })).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /Save to Google Wallet/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(createWalletSpy).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('link', { name: /Open Google Wallet Pass/i })).toBeInTheDocument();
    });

    // Second click uses cached saveUrl synchronously
    fireEvent.click(saveBtn);
    expect(createWalletSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(2);
  });
});

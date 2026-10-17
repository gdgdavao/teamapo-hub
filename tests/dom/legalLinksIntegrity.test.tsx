import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '@/pages/auth/LoginPage';
import AppNavbar from '@/layout/AppNavbar';
import { AbilityProvider } from '@casl/react';
import { defineAbilityFor } from '@/auth/ability';

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'u1', email: 'user@gdgdavao.org', displayName: 'Davao Dev' },
    userProfile: { uid: 'u1', email: 'user@gdgdavao.org', role: 'admin' },
    loading: false,
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    logout: vi.fn(),
  }),
}));

const TEST_ABILITY = defineAbilityFor({
  uid: 'u1',
  role: 'admin',
  isActive: true,
});

describe('Platform-Wide Legal Links Integrity', () => {
  it('renders Terms of Service and Privacy Policy links in LoginPage AuthShell footer', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });

    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms-of-service');

    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy');

    const gdgLink = screen.getByRole('link', { name: /gdg davao/i });
    expect(gdgLink).toBeInTheDocument();
    expect(gdgLink).toHaveAttribute('href', 'https://gdgdavao.org');
  });

  it('renders Privacy Policy & Terms of Service in AppNavbar', () => {
    render(
      <MemoryRouter>
        <AbilityProvider value={TEST_ABILITY}>
          <AppNavbar />
        </AbilityProvider>
      </MemoryRouter>
    );

    // Desktop link
    const desktopLink = screen.getByRole('link', { name: /privacy policy & terms of service/i });
    expect(desktopLink).toBeInTheDocument();
    expect(desktopLink).toHaveAttribute('href', '/privacy');

    // Mobile links
    const mobilePrivacy = screen.getByRole('link', { name: 'Privacy Policy' });
    const mobileTerms = screen.getByRole('link', { name: 'Terms of Service' });

    expect(mobilePrivacy).toBeInTheDocument();
    expect(mobilePrivacy).toHaveAttribute('href', '/privacy');

    expect(mobileTerms).toBeInTheDocument();
    expect(mobileTerms).toHaveAttribute('href', '/terms-of-service');
  });
});

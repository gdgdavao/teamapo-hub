import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { describe, it, expect, vi } from 'vitest';
import { defineAbilityFor } from '@/auth/ability';
import HomePage from '@/pages/home/HomePage';

let mockUserProfile: any = {
  uid: 'org-1',
  email: 'org@gdgdavao.org',
  role: 'organizer',
  isActive: true,
  displayName: 'Organizer Jane',
};

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockUserProfile ? { uid: mockUserProfile.uid, email: mockUserProfile.email } : null,
    userProfile: mockUserProfile,
    loading: false,
  }),
}));

vi.mock('@/pages/home/platform/PlatformHome', () => ({
  default: () => <div data-testid="platform-home">Platform Home Rendered</div>,
}));

vi.mock('@/pages/home/scoped/ScopedHome', () => ({
  default: () => <div data-testid="scoped-home">Scoped Home Rendered</div>,
}));

describe('HomePage RBAC/ABPAC Dispatch', () => {
  it('dispatches to PlatformHome for an organizer under communal event model', () => {
    mockUserProfile = {
      uid: 'org-1',
      email: 'org@gdgdavao.org',
      role: 'organizer',
      isActive: true,
      displayName: 'Organizer Jane',
    };

    const ability = defineAbilityFor(mockUserProfile);

    render(
      <MemoryRouter>
        <AbilityProvider value={ability}>
          <HomePage />
        </AbilityProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('platform-home')).toBeInTheDocument();
  });

  it('dispatches to PlatformHome for an admin', () => {
    mockUserProfile = {
      uid: 'admin-1',
      email: 'admin@gdgdavao.org',
      role: 'admin',
      isActive: true,
      displayName: 'Admin Boss',
    };

    const ability = defineAbilityFor(mockUserProfile);

    render(
      <MemoryRouter>
        <AbilityProvider value={ability}>
          <HomePage />
        </AbilityProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('platform-home')).toBeInTheDocument();
    expect(screen.queryByTestId('scoped-home')).not.toBeInTheDocument();
  });
});

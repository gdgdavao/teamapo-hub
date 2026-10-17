import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineAbilityFor } from '@/auth/ability';
import AdminUsersPage from '@/pages/users/UsersPage';
import { UserService, UserWithMetadata } from '@/services/userService';
import { CreateUserModal } from '@/pages/users/components/CreateUserModal';
import { EditUserModal } from '@/pages/users/components/EditUserModal';
import { UserRowActionsDropdown } from '@/pages/users/components/UserRowActionsDropdown';
import { ORGANIZER_PERMISSION_PRESETS } from '@/types';

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
  functions: {},
}));

const mockCreateUser = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'admin-1', email: 'admin@gdgdavao.org', displayName: 'Lead Admin' },
    userProfile: { uid: 'admin-1', email: 'admin@gdgdavao.org', role: 'admin', isActive: true },
    createUser: mockCreateUser,
    loading: false,
    logout: vi.fn(),
  }),
}));

vi.mock('@/services/userService', () => ({
  UserService: {
    getAllUsers: vi.fn(),
    updateUserProfile: vi.fn(),
    sendPasswordReset: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

vi.mock('@/services/auditLogService', () => ({
  AuditLogService: {
    recordAuditLog: vi.fn().mockResolvedValue(undefined),
  },
}));

const ADMIN_ABILITY = defineAbilityFor({
  uid: 'admin-1',
  role: 'admin',
  isActive: true,
  isSuperUser: true,
});

const mockUsers: UserWithMetadata[] = [
  {
    uid: 'admin-1',
    email: 'admin@gdgdavao.org',
    displayName: 'Lead Admin',
    role: 'admin',
    isActive: true,
    lastLogin: new Date('2026-10-15T08:00:00.000Z'),
  },
  {
    uid: 'org-1',
    email: 'sarah@gdgdavao.org',
    displayName: 'Sarah Chen',
    role: 'organizer',
    isActive: true,
    organization: 'GDG Davao Team',
    permissions: ORGANIZER_PERMISSION_PRESETS.full.permissions,
    lastLogin: new Date('2026-10-14T08:00:00.000Z'),
  },
  {
    uid: 'org-2',
    email: 'mark@gdgdavao.org',
    displayName: 'Mark Santos',
    role: 'organizer',
    isActive: false,
    permissions: ORGANIZER_PERMISSION_PRESETS.staff.permissions,
    lastLogin: new Date('2026-09-01T08:00:00.000Z'),
  },
];

const renderUsersPage = () =>
  render(
    <MemoryRouter>
      <AbilityProvider value={ADMIN_ABILITY}>
        <AdminUsersPage />
      </AbilityProvider>
    </MemoryRouter>
  );

describe('Modernized UsersPage & Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (UserService.getAllUsers as any).mockResolvedValue(mockUsers);
    (UserService.updateUserProfile as any).mockResolvedValue(undefined);
    (UserService.sendPasswordReset as any).mockResolvedValue(undefined);
    (UserService.deleteUser as any).mockResolvedValue(undefined);
  });

  it('renders the unified metric summary bar without the old isolated stat cards', async () => {
    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    // Check metric summary values
    expect(screen.getByText('Total:')).toBeInTheDocument();
    expect(screen.getByText('Organizers:')).toBeInTheDocument();
    expect(screen.getByText('Admins:')).toBeInTheDocument();
    expect(screen.getByText('Active:')).toBeInTheDocument();

    // Verify user rows rendered in the table
    const table = screen.getByRole('table');
    expect(within(table).getByText('Lead Admin')).toBeInTheDocument();
    expect(within(table).getByText('Sarah Chen')).toBeInTheDocument();
    expect(within(table).getByText('Mark Santos')).toBeInTheDocument();

    // Verify "You" badge capsule
    const youBadge = within(table).getByText('You');
    expect(youBadge).toBeInTheDocument();
    expect(youBadge.className).toContain('rounded-full');
    expect(youBadge.className).toContain('bg-secondary-container');

    // Verify Role & Permission Badges
    expect(within(table).getByText('Admin')).toBeInTheDocument();
    expect(within(table).getAllByText('Organizer')).toHaveLength(2);
    expect(within(table).getByText('Full Access')).toBeInTheDocument();
    expect(within(table).getByText('Staff')).toBeInTheDocument();

    // Verify Status Badges
    const activeBadges = within(table).getAllByText('Active');
    const inactiveBadges = within(table).getAllByText('Inactive');
    expect(activeBadges.length).toBeGreaterThanOrEqual(1);
    expect(inactiveBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('filters users via SegmentedControl role selection', async () => {
    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    });

    // Click "Admins (1)" radio option in SegmentedControl
    const adminOption = screen.getByRole('radio', { name: /admins \(1\)/i });
    fireEvent.click(adminOption);

    // Only Lead Admin should remain in table, organizers filtered out
    const table = screen.getByRole('table');
    expect(within(table).getByText('Lead Admin')).toBeInTheDocument();
    expect(within(table).queryByText('Sarah Chen')).not.toBeInTheDocument();
    expect(within(table).queryByText('Mark Santos')).not.toBeInTheDocument();
  });

  it('CreateUserModal generates secure passwords and validates required fields', async () => {
    const handleCreate = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <CreateUserModal
        isOpen={true}
        onClose={handleClose}
        onCreateUser={handleCreate}
      />
    );

    expect(screen.getByText('Create User Account')).toBeInTheDocument();

    // Generate secure password
    const generateBtn = screen.getByRole('button', { name: /generate secure password/i });
    fireEvent.click(generateBtn);

    const passwordInput = screen.getByLabelText(/initial password/i) as HTMLInputElement;
    expect(passwordInput.value.length).toBeGreaterThanOrEqual(12);

    // Enter name & email
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'New Organizer' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'new@gdgdavao.org' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));

    await waitFor(() => {
      expect(handleCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'New Organizer',
          email: 'new@gdgdavao.org',
          role: 'organizer',
        })
      );
    });
  });

  it('EditUserModal allows editing display name and toggling active status', async () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <EditUserModal
        isOpen={true}
        user={mockUsers[1]} // Sarah Chen
        onClose={handleClose}
        onUpdateUser={handleUpdate}
      />
    );

    expect(screen.getByText('Edit User Profile')).toBeInTheDocument();
    expect(screen.getByText('sarah@gdgdavao.org')).toBeInTheDocument();

    // Toggle status to inactive
    const inactiveRadio = screen.getByRole('radio', { name: /suspended \/ inactive/i });
    fireEvent.click(inactiveRadio);

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          displayName: 'Sarah Chen',
          isActive: false,
        })
      );
    });
  });

  it('UserRowActionsDropdown reveals menu options and handles actions', async () => {
    const onEdit = vi.fn();
    const onToggleStatus = vi.fn();
    const onSendPasswordReset = vi.fn();
    const onDelete = vi.fn();

    render(
      <UserRowActionsDropdown
        user={mockUsers[1]}
        canDelete={true}
        onEdit={onEdit}
        onToggleStatus={onToggleStatus}
        onSendPasswordReset={onSendPasswordReset}
        onDelete={onDelete}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /actions for sarah chen/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /edit details & permissions/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /deactivate account/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /send password reset/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete account/i })).toBeInTheDocument();

    // Click Send Password Reset
    fireEvent.click(screen.getByRole('menuitem', { name: /send password reset/i }));
    expect(onSendPasswordReset).toHaveBeenCalledWith(mockUsers[1]);
  });

  it('allows deleting a peer admin account via high-friction confirmation modal', async () => {
    const peerAdmin: UserWithMetadata = {
      uid: 'admin-2',
      email: 'peer@gdgdavao.org',
      displayName: 'Peer Admin',
      role: 'admin',
      isActive: true,
      lastLogin: new Date('2026-10-16T08:00:00.000Z'),
    };
    (UserService.getAllUsers as any).mockResolvedValue([...mockUsers, peerAdmin]);

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('Peer Admin')).toBeInTheDocument();
    });

    // Verify row checkbox for peer admin is disabled with explanatory tooltip
    const peerCheckbox = screen.getByRole('checkbox', { name: /select peer admin/i });
    expect(peerCheckbox).toBeDisabled();
    expect(peerCheckbox).toHaveAttribute(
      'title',
      'Admin accounts cannot be bulk deleted. Please delete individually.'
    );

    // Open dropdown for peer admin
    const trigger = screen.getByRole('button', { name: /actions for peer admin/i });
    fireEvent.click(trigger);

    // Click delete account
    const deleteMenuItem = screen.getByRole('menuitem', { name: /delete account/i });
    expect(deleteMenuItem).not.toBeDisabled();
    fireEvent.click(deleteMenuItem);

    // High friction modal should appear
    expect(screen.getByText('Delete Administrator Account')).toBeInTheDocument();
    expect(screen.getByText('Elevated Privilege Account')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /permanently delete admin/i });
    expect(deleteBtn).toBeDisabled();

    // Type partial or wrong email
    const emailInput = screen.getByLabelText(/confirm administrator email/i);
    fireEvent.change(emailInput, { target: { value: 'wrong@gdgdavao.org' } });
    expect(deleteBtn).toBeDisabled();

    // Type matching email
    fireEvent.change(emailInput, { target: { value: 'peer@gdgdavao.org' } });
    expect(deleteBtn).not.toBeDisabled();

    // Click confirm delete
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(UserService.deleteUser).toHaveBeenCalledWith('admin-2');
    });
  });

  it('disables deleting the last remaining active administrator', async () => {
    // Only 1 admin in mockUsers (admin-1), and Sarah & Mark are organizers
    (UserService.getAllUsers as any).mockResolvedValue(mockUsers);

    renderUsersPage();

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    expect(within(table).getByText('Lead Admin')).toBeInTheDocument();

    // Own account cannot be deleted
    const trigger = screen.getByRole('button', { name: /actions for lead admin/i });
    fireEvent.click(trigger);

    const deleteMenuItem = screen.getByRole('menuitem', { name: /delete account/i });
    expect(deleteMenuItem).toBeDisabled();
    expect(deleteMenuItem).toHaveAttribute('title', 'You cannot delete your own account');
  });
});

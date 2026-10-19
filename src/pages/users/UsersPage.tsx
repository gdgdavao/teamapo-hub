import React, { useState, useEffect, useMemo } from 'react';
import { useAbility } from '@casl/react';
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { User, OrganizerPermissions } from '../../types';
import AppShell from '../../layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { UserService, UserWithMetadata } from '../../services/userService';
import { AuditLogService } from '../../services/auditLogService';
import { EventService } from '../../services/eventService';
import { asUser } from '../../auth/ability';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';
import { Button, Badge, ConfirmationModal, Modal, Input, SegmentedControl, Select, EmptyState } from '../../components/UI';
import CreateUserModal, { CreateUserData } from './components/CreateUserModal';
import EditUserModal from './components/EditUserModal';
import UserRowActionsDropdown from './components/UserRowActionsDropdown';

const AdminUsersPage: React.FC = () => {
  const { currentUser, createUser } = useAuth();
  const ability = useAbility();

  const [users, setUsers] = useState<UserWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'organizer' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithMetadata | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserWithMetadata | null>(null);
  const [adminDeleteConfirmEmail, setAdminDeleteConfirmEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      const usersData = await UserService.getAllUsers();
      setUsers(usersData);
    } catch (error) {
      logger.error('Error fetching users:', error);
      toast.error('Failed to fetch users. Please reload the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role === 'admin' && u.isActive !== false).length,
    [users]
  );

  // Owned-events pre-flight for the delete confirmations. The deleteUser
  // callable refuses accounts that still own an active event
  // (draft/published/ongoing) because rules pin organizer.uid immutably and
  // those events would be left ownerless and unmanageable. Surfacing the same
  // fact here makes that refusal a visible pre-condition instead of a surprise
  // server toast.
  const [ownedEventsByUid, setOwnedEventsByUid] = useState<
    Record<string, { total: number; active: number; titles: string[] }>
  >({});

  const refreshOwnedEventCounts = React.useCallback(async () => {
    try {
      const events = await EventService.getAllEvents();
      const counts: Record<string, { total: number; active: number; titles: string[] }> = {};
      for (const ev of events) {
        const uid = ev.organizer?.uid;
        if (!uid) continue;
        const entry = counts[uid] ?? { total: 0, active: 0, titles: [] };
        entry.total += 1;
        if (ev.status && ['draft', 'published', 'ongoing'].includes(ev.status)) {
          entry.active += 1;
          if (entry.titles.length < 3) entry.titles.push(ev.title);
        }
        counts[uid] = entry;
      }
      setOwnedEventsByUid(counts);
    } catch (error) {
      // Advisory only: the callable's own guard is the enforcement, so a
      // pre-check failure degrades to a server refusal on confirm.
      logger.warn('Owned-events pre-check unavailable:', error);
    }
  }, []);

  useEffect(() => {
    void refreshOwnedEventCounts();
  }, [refreshOwnedEventCounts]);

  const getOwnedEvents = React.useCallback(
    (uid: string) => ownedEventsByUid[uid] ?? { total: 0, active: 0, titles: [] as string[] },
    [ownedEventsByUid]
  );

  const canDeleteUser = React.useCallback(
    (user: UserWithMetadata) => {
      if (!ability.can('delete', asUser(user as User))) {
        return false;
      }
      // Last-admin safeguard: prohibit deleting the platform's last remaining active admin
      if (user.role === 'admin' && user.isActive !== false && activeAdminCount <= 1) {
        return false;
      }
      return true;
    },
    [ability, activeAdminCount]
  );

  const getDeleteTooltip = React.useCallback(
    (user: UserWithMetadata) => {
      if (user.uid === currentUser?.uid) {
        return 'You cannot delete your own account';
      }
      if (user.role === 'admin' && user.isActive !== false && activeAdminCount <= 1) {
        return 'Cannot delete the platform’s last remaining active administrator';
      }
      return undefined;
    },
    [currentUser?.uid, activeAdminCount]
  );

  const handleCreateUser = async (userData: CreateUserData) => {
    try {
      setIsCreating(true);
      const newUser = await createUser(
        userData.email,
        userData.password,
        userData.displayName,
        userData.role,
        userData.role === 'organizer' ? userData.permissions : undefined
      );

      const newUserForState: UserWithMetadata = {
        ...newUser,
        permissions: userData.role === 'organizer' ? userData.permissions : undefined,
        lastLogin: new Date(),
        isActive: true,
      };

      setUsers((prev) => [newUserForState, ...prev]);
      setShowCreateModal(false);
      toast.success(`User ${userData.displayName} created. Invitation emailed to ${userData.email}.`);

      void AuditLogService.recordAuditLog({
        category: 'user_management',
        action: 'user_created',
        target: {
          type: 'user',
          id: newUser.uid,
          label: userData.displayName,
        },
        details: {
          email: userData.email,
          role: userData.role,
        },
      });
    } catch (error: any) {
      logger.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      setIsUpdating(true);
      await UserService.updateUserProfile(userId, updates);
      await fetchUsers();
      setShowEditModal(false);
      setEditingUser(null);
      toast.success('User updated successfully');

      void AuditLogService.recordAuditLog({
        category: 'user_management',
        action: updates.role ? 'role_changed' : 'user_updated',
        target: {
          type: 'user',
          id: userId,
          label: editingUser?.displayName || updates.displayName,
        },
        details: {
          role: updates.role ?? null,
          displayName: updates.displayName ?? null,
          organization: updates.organization ?? null,
        },
      });
    } catch (error) {
      logger.error('Error updating user:', error);
      toast.error('Failed to update user. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (targetUser: UserWithMetadata) => {
    const nextStatus = targetUser.isActive === false;
    try {
      await UserService.updateUserProfile(targetUser.uid, { isActive: nextStatus });
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, isActive: nextStatus } : u))
      );
      toast.success(
        nextStatus
          ? `Account for ${targetUser.displayName} reactivated.`
          : `Account for ${targetUser.displayName} deactivated.`
      );

      void AuditLogService.recordAuditLog({
        category: 'user_management',
        action: 'user_updated',
        target: {
          type: 'user',
          id: targetUser.uid,
          label: targetUser.displayName,
        },
        details: {
          statusChange: nextStatus ? 'reactivated' : 'deactivated',
          isActive: nextStatus,
        },
      });
    } catch (error) {
      logger.error('Error toggling user status:', error);
      toast.error('Failed to update user status.');
    }
  };

  const handleSendPasswordReset = async (targetUser: UserWithMetadata) => {
    try {
      await UserService.sendPasswordReset(targetUser.email);
      toast.success(`Password reset email sent to ${targetUser.email}`);

      void AuditLogService.recordAuditLog({
        category: 'user_management',
        action: 'email_sent',
        target: {
          type: 'user',
          id: targetUser.uid,
          label: targetUser.displayName,
        },
        details: {
          type: 'password_reset',
          email: targetUser.email,
        },
      });
    } catch (error: any) {
      logger.error('Error sending password reset:', error);
      toast.error(error.message || 'Failed to send password reset email');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setIsDeleting(true);
      await UserService.deleteUser(userId);
      setUsers((prev) => prev.filter((user) => user.uid !== userId));
      setSelectedUsers((prev) => prev.filter((id) => id !== userId));
      toast.success('User deleted and signed out everywhere');
      setShowDeleteModal(false);
      setDeletingUser(null);
      setAdminDeleteConfirmEmail('');

      // No client-side audit record here: the deleteUser callable already
      // writes the authoritative user_deleted entry (actor, authAccountRemoved,
      // profilePictureFilesRemoved). Recording it from the browser too only
      // produced a duplicate that outran the server's richer entry.
    } catch (error: any) {
      logger.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const usersToDelete = users.filter(
      (user) => selectedUsers.includes(user.uid) && canDeleteUser(user) && user.role !== 'admin'
    );

    if (usersToDelete.length === 0) {
      toast.error('Selected users cannot be deleted.');
      return;
    }

    try {
      setIsBulkDeleting(true);
      // The callable refuses accounts with unresolved constraints (owned
      // active events, superuser, last admin), so a mixed selection is the
      // expected outcome: settle every call and report both halves rather
      // than letting a single refusal discard the whole batch state.
      const results = await Promise.allSettled(
        usersToDelete.map((user) => UserService.deleteUser(user.uid))
      );

      const deleted = usersToDelete.filter((_, index) => results[index].status === 'fulfilled');
      const refused = usersToDelete.filter((_, index) => results[index].status === 'rejected');

      if (deleted.length > 0) {
        setUsers((prev) => prev.filter((user) => !deleted.some((u) => u.uid === user.uid)));
        await fetchUsers();
      }
      setSelectedUsers([]);
      setShowBulkDeleteModal(false);

      if (refused.length === 0) {
        toast.success(`${deleted.length} user account(s) deleted successfully`);
      } else if (deleted.length === 0) {
        toast.error(
          `No accounts were deleted: the platform refused all ${refused.length} (active events or protected accounts).`
        );
      } else {
        toast(
          `${deleted.length} user account(s) deleted; ${refused.length} refused because they still own active events.`,
          { icon: '⚠️' }
        );
      }
      // No client-side audit records: the callable writes the authoritative
      // user_deleted entry for each account it actually removes.
    } catch (error) {
      logger.error('Error deleting users:', error);
      toast.error('Failed to delete some users. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = users.length;
    const organizers = users.filter((u) => u.role === 'organizer').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const active = users.filter((u) => u.isActive !== false).length;
    return { total, organizers, admins, active };
  }, [users]);

  // Filtering and sorting
  const filteredAndSortedUsers = useMemo(() => {
    return users
      .filter((user) => {
        const matchesSearch =
          user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.organization && user.organization.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesRole = roleFilter === 'all' || user.role === roleFilter;

        const isUserActive = user.isActive !== false;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && isUserActive) ||
          (statusFilter === 'inactive' && !isUserActive);

        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case 'name':
            aValue = a.displayName.toLowerCase();
            bValue = b.displayName.toLowerCase();
            break;
          case 'email':
            aValue = a.email.toLowerCase();
            bValue = b.email.toLowerCase();
            break;
          case 'role':
            aValue = a.role;
            bValue = b.role;
            break;
          case 'createdAt':
            aValue =
              a.createdAt?.toDate?.() ||
              (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0));
            bValue =
              b.createdAt?.toDate?.() ||
              (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0));
            break;
          default:
            return 0;
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [users, searchTerm, roleFilter, statusFilter, sortBy, sortOrder]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <ChevronUpDownIcon className="h-4 w-4 opacity-40 shrink-0" />;
    return sortOrder === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4 text-primary shrink-0" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-primary shrink-0" />
    );
  };

  const getPermissionsSummary = (perms?: OrganizerPermissions): string => {
    if (!perms) return 'Standard';
    if ((perms.events?.canCreate && perms.events?.canUpdate && perms.payments?.canVerify && perms.certificates?.canManage) || perms.events?.canDelete) {
      return 'Full Access';
    }
    if (perms.checkin?.canCheckIn && !perms.events?.canUpdate && !perms.certificates?.canManage) return 'Staff';
    if (perms.certificates?.canManage && !perms.events?.canUpdate) return 'Certificates';
    if (!perms.events?.canUpdate && !perms.attendees?.canUpdate) return 'Read-Only';
    return 'Custom';
  };

  const getPermissionsBadgeTone = (perms?: OrganizerPermissions): 'neutral' | 'warning' => {
    if (!perms) return 'neutral';
    if (!perms.events?.canUpdate && !perms.attendees?.canUpdate) return 'warning';
    return 'neutral';
  };

  const formatLastLogin = (lastLogin: Date | undefined) => {
    if (!lastLogin) return 'Never';
    if (lastLogin instanceof Date) {
      return lastLogin.toLocaleDateString();
    }
    return 'Never';
  };

  const deletableSelectedCount = selectedUsers.filter((id) => {
    const user = users.find((u) => u.uid === id);
    return user ? canDeleteUser(user) && user.role !== 'admin' : false;
  }).length;

  if (loading) {
    return (
      <AppShell title="Users" fullWidth={true}>
        <div className="flex justify-center items-center h-64">
          <div className="motion-essential animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="User Management"
      subtitle="Manage user accounts, roles, and granular organizer permissions"
      fullWidth={true}
    >
      <div className="space-y-5">
        {/* Metric Summary Bar - Replaces disconnected stat cards */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-5 sm:py-3 rounded-xl border border-outline-variant bg-surface-container-low text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 divide-x divide-outline-variant/60">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden="true" />
              <span className="text-on-surface-variant font-medium">Total:</span>
              <span className="font-bold text-on-surface">{metrics.total}</span>
            </div>
            <div className="flex items-center gap-2 pl-4 sm:pl-6">
              <UserIcon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span className="text-on-surface-variant font-medium">Organizers:</span>
              <span className="font-bold text-on-surface">{metrics.organizers}</span>
            </div>
            <div className="flex items-center gap-2 pl-4 sm:pl-6">
              <ShieldCheckIcon className="h-4 w-4 text-error shrink-0" aria-hidden="true" />
              <span className="text-on-surface-variant font-medium">Admins:</span>
              <span className="font-bold text-on-surface">{metrics.admins}</span>
            </div>
            <div className="flex items-center gap-2 pl-4 sm:pl-6">
              <CheckCircleIcon className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
              <span className="text-on-surface-variant font-medium">Active:</span>
              <span className="font-bold text-success">{metrics.active}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <Button
              variant="tonal"
              size="sm"
              onClick={fetchUsers}
              className="text-xs"
            >
              <ArrowPathIcon className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button
              variant="filled"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="text-xs"
            >
              <PlusIcon className="h-3.5 w-3.5 mr-1.5" />
              Add User
            </Button>
          </div>
        </div>

        {/* Integrated Toolbar: Search, Segmented Role Filter, Status Filter, and Bulk Actions */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-outline"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search users by name, email, org..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Role Filter Segmented Control */}
            <div className="w-full sm:w-auto">
              <SegmentedControl
                label="Filter by role"
                value={roleFilter}
                onChange={(val) => setRoleFilter(val as typeof roleFilter)}
                options={[
                  { value: 'all', label: `All (${metrics.total})` },
                  { value: 'organizer', label: `Organizers (${metrics.organizers})` },
                  { value: 'admin', label: `Admins (${metrics.admins})` },
                ]}
              />
            </div>

            {/* Status Filter Dropdown */}
            <div className="w-full sm:w-auto min-w-[130px]">
              <Select
                aria-label="Filter by account status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                size="md"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </Select>
            </div>
          </div>

          {/* Bulk Actions Button */}
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="md"
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={deletableSelectedCount === 0}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete Selected ({deletableSelectedCount})
              </Button>
            </div>
          )}
        </div>

        {/* Users Data Table */}
        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline-variant text-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all deletable users"
                      checked={
                        selectedUsers.length > 0 &&
                        selectedUsers.length ===
                          filteredAndSortedUsers.filter((u) => canDeleteUser(u) && u.role !== 'admin').length &&
                        filteredAndSortedUsers.filter((u) => canDeleteUser(u) && u.role !== 'admin').length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(
                            filteredAndSortedUsers
                              .filter((u) => canDeleteUser(u) && u.role !== 'admin')
                              .map((u) => u.uid)
                          );
                        } else {
                          setSelectedUsers([]);
                        }
                      }}
                      className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:bg-surface-container transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Name</span>
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:bg-surface-container transition-colors"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Email</span>
                      <SortIcon field="email" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:bg-surface-container transition-colors"
                    onClick={() => handleSort('role')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Role & Permissions</span>
                      <SortIcon field="role" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:bg-surface-container transition-colors"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Created</span>
                      <SortIcon field="createdAt" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Last Active
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant bg-surface">
                {filteredAndSortedUsers.map((user) => {
                  const isCurrentUser = user.uid === currentUser?.uid;
                  const isDeletable = canDeleteUser(user);
                  const isSelected = selectedUsers.includes(user.uid);
                  const isActive = user.isActive !== false;

                  return (
                    <tr
                      key={user.uid}
                      className={`transition-colors duration-fast ${
                        isCurrentUser ? 'bg-primary-container/20' : 'hover:bg-surface-container-low'
                      } ${isSelected ? 'bg-primary-container/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isDeletable || user.role === 'admin'}
                          aria-label={`Select ${user.displayName}`}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers((prev) => [...prev, user.uid]);
                            } else {
                              setSelectedUsers((prev) => prev.filter((id) => id !== user.uid));
                            }
                          }}
                          className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 disabled:opacity-40"
                          title={
                            user.role === 'admin'
                              ? 'Admin accounts cannot be bulk deleted. Please delete individually.'
                              : !isDeletable
                              ? getDeleteTooltip(user) || 'Protected account cannot be deleted'
                              : ''
                          }
                        />
                      </td>

                      {/* Name & Avatar */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName}
                              className="h-8 w-8 rounded-full object-cover border border-outline-variant shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center font-bold text-xs shrink-0">
                              {user.displayName?.charAt(0)?.toUpperCase() || (
                                <UserIcon className="h-4 w-4" />
                              )}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-on-surface flex items-center gap-1.5 truncate">
                              <span>{user.displayName}</span>
                              {isCurrentUser && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-container text-on-secondary-container tracking-wide">
                                  You
                                </span>
                              )}
                            </div>
                            {user.organization && (
                              <div className="text-xs text-on-surface-variant truncate">
                                {user.organization}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 whitespace-nowrap text-on-surface text-sm font-mono text-xs">
                        {user.email}
                      </td>

                      {/* Role & Permissions Summary */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge tone={user.role === 'admin' ? 'danger' : 'info'}>
                            {user.role === 'admin' ? 'Admin' : 'Organizer'}
                          </Badge>
                          {user.role === 'organizer' && (
                            <Badge tone={getPermissionsBadgeTone(user.permissions)}>
                              {getPermissionsSummary(user.permissions)}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-on-surface-variant">
                        {user.createdAt?.toDate?.()?.toLocaleDateString() ||
                          (user.createdAt?.seconds
                            ? new Date(user.createdAt.seconds * 1000).toLocaleDateString()
                            : 'Unknown')}
                      </td>

                      {/* Last Login */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-on-surface-variant">
                        {formatLastLogin(user.lastLogin)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge tone={isActive ? 'success' : 'neutral'}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isActive ? 'bg-success' : 'bg-on-surface-variant/60'
                            }`}
                            aria-hidden="true"
                          />
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(user);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 text-primary hover:text-primary-hover hover:bg-surface-container rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Edit user details & permissions"
                            aria-label={`Edit ${user.displayName}`}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>

                          <UserRowActionsDropdown
                            user={user}
                            canDelete={isDeletable}
                            deleteTooltip={getDeleteTooltip(user)}
                            onEdit={(u) => {
                              setEditingUser(u);
                              setShowEditModal(true);
                            }}
                            onToggleStatus={handleToggleStatus}
                            onSendPasswordReset={handleSendPasswordReset}
                            onDelete={(u) => {
                              setDeletingUser(u);
                              setAdminDeleteConfirmEmail('');
                              setShowDeleteModal(true);
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredAndSortedUsers.length === 0 && (
            <div className="p-8">
              <EmptyState
                icon={<UserGroupIcon className="h-6 w-6" />}
                title="No users found"
                description={
                  searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'No accounts match your search query or selected filters. Try broadening your criteria.'
                    : 'No user accounts exist in the platform yet.'
                }
                action={
                  searchTerm || roleFilter !== 'all' || statusFilter !== 'all' ? (
                    <Button
                      variant="tonal"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setRoleFilter('all');
                        setStatusFilter('all');
                      }}
                    >
                      Clear search & filters
                    </Button>
                  ) : (
                    <Button variant="filled" size="sm" onClick={() => setShowCreateModal(true)}>
                      <PlusIcon className="h-4 w-4 mr-1.5" />
                      Add first user
                    </Button>
                  )
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateUser={handleCreateUser}
        isSubmitting={isCreating}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditModal && !!editingUser}
        user={editingUser}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        onUpdateUser={handleUpdateUser}
        isSubmitting={isUpdating}
      />

      {/* Delete Administrator Modal (High Friction Confirmation) */}
      <Modal
        open={showDeleteModal && deletingUser?.role === 'admin'}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setDeletingUser(null);
            setAdminDeleteConfirmEmail('');
          }
        }}
        size="md"
        title="Delete Administrator Account"
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                if (!isDeleting) {
                  setShowDeleteModal(false);
                  setDeletingUser(null);
                  setAdminDeleteConfirmEmail('');
                }
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingUser && handleDeleteUser(deletingUser.uid)}
              disabled={
                !deletingUser ||
                adminDeleteConfirmEmail.trim().toLowerCase() !== deletingUser.email.trim().toLowerCase() ||
                isDeleting ||
                (deletingUser && getOwnedEvents(deletingUser.uid).active > 0)
              }
              loading={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Permanently Delete Admin'}
            </Button>
          </>
        }
      >
        {deletingUser && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-error-container/20 border border-error/30 rounded-xl">
              <ExclamationTriangleIcon className="h-5 w-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold text-on-surface">Elevated Privilege Account</p>
                <p className="text-on-surface-variant text-xs mt-0.5">
                  You are about to permanently delete an Administrator account. This will immediately revoke their access to all platform systems, delete their authentication profile, and terminate all active sessions.
                </p>
              </div>
            </div>

            {(() => {
              const owned = getOwnedEvents(deletingUser.uid);
              if (owned.active === 0) return null;
              return (
                <div className="flex items-start gap-3 p-3.5 bg-warning-container/30 border border-warning/40 rounded-xl text-sm">
                  <ExclamationTriangleIcon className="h-5 w-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-on-surface">
                      Owns {owned.active} active event{owned.active === 1 ? '' : 's'}
                    </p>
                    <p className="text-on-surface-variant text-xs mt-0.5">
                      {owned.titles.join(', ')}
                      {owned.active > owned.titles.length ? ` and ${owned.active - owned.titles.length} more` : ''}.
                      Their rules-pinned organizer.uid makes these unmanageable after deletion, so the platform refuses
                      the account delete until the events are completed, cancelled, reassigned, or removed.
                    </p>
                  </div>
                </div>
              );
            })()}

            <p className="text-sm text-on-surface">
              Target Administrator: <span className="font-semibold text-on-surface">{deletingUser.displayName}</span> (<span className="font-mono text-xs text-primary">{deletingUser.email}</span>)
            </p>

            <div>
              <p className="text-sm text-on-surface-variant mb-2">
                To confirm deletion, please type the administrator's email (<span className="font-mono font-medium text-on-surface text-xs select-all">{deletingUser.email}</span>) below:
              </p>
              <Input
                label="Confirm Administrator Email"
                value={adminDeleteConfirmEmail}
                onChange={(e) => setAdminDeleteConfirmEmail(e.target.value)}
                placeholder={deletingUser.email}
                className="w-full"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Delete User Confirmation Modal (Standard for non-admins) */}
      <ConfirmationModal
        isOpen={showDeleteModal && !!deletingUser && deletingUser.role !== 'admin'}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setDeletingUser(null);
          }
        }}
        onConfirm={() => deletingUser && handleDeleteUser(deletingUser.uid)}
        title="Delete User Account"
        message={
          deletingUser
            ? `Are you sure you want to delete ${deletingUser.displayName} (${deletingUser.email})? This permanently deletes the account from Firebase Authentication and Firestore, and immediately revokes their sessions.`
            : ''
        }
        confirmText={
          deletingUser && getOwnedEvents(deletingUser.uid).active > 0
            ? 'Resolve Active Events First'
            : 'Delete Account'
        }
        confirmDisabled={!!deletingUser && getOwnedEvents(deletingUser.uid).active > 0}
        type="danger"
        isLoading={isDeleting}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkDeleteModal}
        onClose={() => {
          if (!isBulkDeleting) {
            setShowBulkDeleteModal(false);
          }
        }}
        onConfirm={handleBulkDelete}
        title="Delete Selected Users"
        message={`Are you sure you want to permanently delete ${deletableSelectedCount} user account(s)? Protected admin accounts will not be affected, and accounts that still own active events are refused by the platform. This action cannot be undone.`}
        confirmText={`Delete ${deletableSelectedCount} Users`}
        type="danger"
        isLoading={isBulkDeleting}
      />
    </AppShell>
  );
};

export default AdminUsersPage;

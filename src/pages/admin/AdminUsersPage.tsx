import React, { useState, useEffect } from 'react';
import { useAbility } from '@casl/react';
import { 
  UserGroupIcon, 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  EyeIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { db } from '../../config/firebase';
import { User } from '../../types';
import DashboardShell from '../../components/shared/DashboardShell';
import { useAuth } from '../../contexts/AuthContext';
import { UserService, UserWithMetadata } from '../../services/userService';
import { asUser } from '../../auth/ability';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';
import { Button, Modal } from '../../components/shared/UI';

const AdminUsersPage: React.FC = () => {
  const { updateAnyUserProfile, currentUser, createUser } = useAuth();
  const ability = useAbility();
  const [users, setUsers] = useState<UserWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'organizer' | 'admin'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithMetadata | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserWithMetadata | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await UserService.getAllUsers({
        searchTerm: searchTerm || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter
      });
      setUsers(usersData);
    } catch (error) {
      logger.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await UserService.deleteUser(userId);
      setUsers(users.filter(user => user.uid !== userId));
      toast.success('User deleted and signed out everywhere');
      setShowDeleteModal(false);
      setDeletingUser(null);
    } catch (error) {
      logger.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleCreateUser = async (userData: {
    email: string;
    displayName: string;
    role: 'organizer' | 'admin';
    password: string;
  }) => {
    try {
      // Use the new createUser function from auth context
      const newUser = await createUser(userData.email, userData.password, userData.displayName, userData.role);
      
      // Add the new user to the local state
      const newUserForState: UserWithMetadata = {
        ...newUser,
        lastLogin: new Date(),
        isActive: true
      };
      
      setUsers([...users, newUserForState]);
      setShowCreateModal(false);
      
      // Show success message
      toast.success(`User ${userData.displayName} created successfully! Password reset email sent to ${userData.email}.`);
      
    } catch (error: any) {
      logger.error('Error creating user:', error);
      // The createUser function already handles toasts for errors
    }
  };

  // Whether this account may delete a given user. One question, asked of the
  // ability, rather than a private copy of the rule that the button, the bulk
  // selection and the confirmation modal each re-derived - they drifted apart,
  // and the "Cannot Delete" state the button showed was not the rule the bulk
  // path applied.
  //
  // Never yourself, never another admin unless you hold the superuser tier.
  // firestore.rules grants `delete: if isAdmin()` with neither restriction, so
  // this is deliberately stricter than the server; functions/main.py's deleteUser
  // enforces the same shape from SUPERUSER_EMAIL, which is the half that cannot
  // be bypassed from a browser.
  const canDeleteUser = (user: UserWithMetadata) =>
    ability.can('delete', asUser(user as User));

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      await UserService.updateUserProfile(userId, updates);
      
      // Refresh users list to get updated metadata
      await fetchUsers();
      
      setShowEditModal(false);
      setEditingUser(null);
      toast.success('User updated successfully');
    } catch (error) {
      logger.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;
    
    // Filter out users that cannot be deleted
    const usersToDelete = users.filter(user => 
      selectedUsers.includes(user.uid) && canDeleteUser(user)
    );
    
    if (usersToDelete.length === 0) {
      toast.error('No users can be deleted from selection');
      return;
    }
    
    if (usersToDelete.length < selectedUsers.length) {
      toast('Some admin users cannot be deleted and will be skipped', {
        icon: '⚠️',
        duration: 4000,
      });
    }
    
    try {
      // Through the same callable as the single delete. This used to write
      // deleteDoc straight to Firestore, which left the Firebase Auth account
      // alive: an orphaned account can still sign in, and since every callable
      // skipped its permission check when the users document was absent, it
      // reached Admin SDK writes that never pass through firestore.rules. It
      // also broke AGENTS.md 4.1, which reserves the Firestore SDK for src/services.
      await Promise.all(usersToDelete.map(user => UserService.deleteUser(user.uid)));

      setUsers(users.filter(user => !usersToDelete.map(u => u.uid).includes(user.uid)));
      setSelectedUsers([]);
      toast.success(`${usersToDelete.length} users deleted successfully`);
    } catch (error) {
      logger.error('Error deleting users:', error);
      toast.error('Failed to delete users');
    }
  };

  const filteredAndSortedUsers = users
    .filter(user => {
      const matchesSearch = user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
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
          // Handle both Firebase timestamp formats
          aValue = a.createdAt?.toDate?.() || 
                   (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0));
          bValue = b.createdAt?.toDate?.() || 
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

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <ChevronUpDownIcon className="h-4 w-4" />;
    return sortOrder === 'asc' ? 
      <ChevronUpIcon className="h-4 w-4" /> : 
      <ChevronDownIcon className="h-4 w-4" />;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'organizer':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastLogin = (lastLogin: Date | undefined) => {
    if (!lastLogin) return 'Never';
    if (lastLogin instanceof Date) {
      return lastLogin.toLocaleDateString();
    }
    return 'Never';
  };

  if (loading) {
    return (
      <DashboardShell title="Users">
        <div className="flex justify-center items-center h-64">
          <div className="motion-essential animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="User Management"
      subtitle="Manage user accounts and permissions"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border border-outline-variant">
            <div className="flex items-center">
              <UserGroupIcon className="h-8 w-8 text-primary" />
              <div className="ml-3">
                <p className="text-sm font-medium text-on-surface-variant">Total Users</p>
                <p className="text-2xl font-bold text-on-surface">{users.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-outline-variant">
            <div className="flex items-center">
              <UserIcon className="h-8 w-8 text-success" />
              <div className="ml-3">
                <p className="text-sm font-medium text-on-surface-variant">Organizers</p>
                <p className="text-2xl font-bold text-on-surface">
                  {users.filter(u => u.role === 'organizer').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-outline-variant">
            <div className="flex items-center">
              <UserIcon className="h-8 w-8 text-error" />
              <div className="ml-3">
                <p className="text-sm font-medium text-on-surface-variant">Admins</p>
                <p className="text-2xl font-bold text-on-surface">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-outline-variant">
            <div className="flex items-center">
              <UserIcon className="h-8 w-8 text-warning" />
              <div className="ml-3">
                <p className="text-sm font-medium text-on-surface-variant">Active Users</p>
                <p className="text-2xl font-bold text-on-surface">
                  {users.filter(u => u.isActive).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-6 rounded-lg border border-outline-variant">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-outline-variant" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="px-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="organizer">Organizer</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={fetchUsers}
                className="px-4 py-2 bg-inverse-surface text-white rounded-lg hover:bg-inverse-surface transition-colors flex items-center gap-2"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </button>
              {selectedUsers.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error-hover transition-colors flex items-center gap-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete Selected ({users.filter(user => selectedUsers.includes(user.uid) && canDeleteUser(user)).length})
                </button>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Create User
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg border border-outline-variant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline-variant">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedUsers.length > 0 && 
                        selectedUsers.length === filteredAndSortedUsers.filter(u => canDeleteUser(u)).length &&
                        filteredAndSortedUsers.filter(u => canDeleteUser(u)).length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(filteredAndSortedUsers.filter(u => canDeleteUser(u)).map(u => u.uid));
                        } else {
                          setSelectedUsers([]);
                        }
                      }}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider cursor-pointer hover:bg-surface-container"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider cursor-pointer hover:bg-surface-container"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      <SortIcon field="email" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider cursor-pointer hover:bg-surface-container"
                    onClick={() => handleSort('role')}
                  >
                    <div className="flex items-center gap-1">
                      Role
                      <SortIcon field="role" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider cursor-pointer hover:bg-surface-container"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      Created
                      <SortIcon field="createdAt" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-outline-variant">
                {filteredAndSortedUsers.map((user) => (
                  <tr key={user.uid} className={`hover:bg-surface-container-low ${user.uid === currentUser?.uid ? 'bg-surface-container-low' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.uid)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user.uid]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.uid));
                          }
                        }}
                        className="rounded border-outline-variant text-primary focus:ring-primary"
                        disabled={!canDeleteUser(user)}
                        title={
                          !canDeleteUser(user) 
                            ? user.uid === currentUser?.uid 
                              ? 'You cannot delete your own account' 
                              : 'Admin users cannot be deleted by regular admins'
                            : ''
                        }
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.photoURL && user.photoURL !== '' ? (
                          <img 
                            src={user.photoURL} 
                            alt={user.displayName}
                            className="h-8 w-8 rounded-full mr-3"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-surface-container-highest mr-3 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-on-surface-variant" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-on-surface flex items-center gap-2">
                            {user.displayName}
                            {user.uid === currentUser?.uid && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-secondary-container text-on-secondary-container">
                                You
                              </span>
                            )}
                          </div>
                          {user.organization && (
                            <div className="text-sm text-on-surface-variant">{user.organization}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                      {user.createdAt?.toDate?.()?.toLocaleDateString() || 
                       (user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                      {formatLastLogin(user.lastLogin)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                        user.isActive ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setShowEditModal(true);
                          }}
                          className="text-primary hover:text-on-secondary-container"
                          title="Edit user"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {canDeleteUser(user) && (
                          <button
                            onClick={() => {
                              setDeletingUser(user);
                              setShowDeleteModal(true);
                            }}
                            className="text-error hover:text-on-error-container"
                            title="Delete user"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredAndSortedUsers.length === 0 && (
            <div className="text-center py-12">
              <UserGroupIcon className="mx-auto h-12 w-12 text-outline-variant" />
              <h3 className="mt-2 text-sm font-medium text-on-surface">No users found</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                {searchTerm || roleFilter !== 'all' ? 'Try adjusting your filters' : 'No users have been created yet'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
        size="md"
        footer={
          <>
            <Button variant="tonal" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-user-form">
              Create User
            </Button>
          </>
        }
      >
        <form
          id="create-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const userData = {
              email: formData.get('email') as string,
              displayName: formData.get('displayName') as string,
              role: formData.get('role') as 'organizer' | 'admin',
              password: formData.get('password') as string
            };
            handleCreateUser(userData);
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">
                Display Name
              </label>
              <input
                type="text"
                name="displayName"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">
                Initial Password
              </label>
              <input
                type="password"
                name="password"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                placeholder="Enter initial password"
                minLength={6}
              />
              <p className="mt-1 text-sm text-on-surface-variant">
                A password reset email will be sent to the user so they can set their own password.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">
                Role
              </label>
              <select
                name="role"
                defaultValue="organizer"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="organizer">Organizer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="bg-surface-container-low border border-outline-variant rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-primary">
                    <strong>Note:</strong> This creates a complete user account in Firebase Authentication and the system database. The user will receive a password reset email to set their own password and can immediately log in with their assigned role.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={showEditModal && !!editingUser}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        size="md"
        footer={
          <>
            <Button variant="tonal" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form">
              Save Changes
            </Button>
          </>
        }
      >
        {editingUser && (
          <form
            id="edit-user-form"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const updates = {
                displayName: formData.get('displayName') as string,
                role: formData.get('role') as 'organizer' | 'admin'
              };
              handleUpdateUser(editingUser.uid, updates);
            }}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  name="displayName"
                  defaultValue={editingUser.displayName}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Role
                </label>
                <select
                  name="role"
                  defaultValue={editingUser.role}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="organizer">Organizer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal && !!deletingUser}
        onClose={() => setShowDeleteModal(false)}
        title="Delete User"
        size="md"
        footer={
          <>
            <Button variant="tonal" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingUser && handleDeleteUser(deletingUser.uid)}
              disabled={!deletingUser || !canDeleteUser(deletingUser)}
            >
              {!deletingUser || !canDeleteUser(deletingUser) ? 'Cannot Delete' : 'Delete User'}
            </Button>
          </>
        }
      >
        {deletingUser && (
          <>
            <p className="text-sm text-on-surface-variant mb-4">
              Are you sure you want to delete <strong>{deletingUser.displayName}</strong>?
              This action cannot be undone.
            </p>
            {!canDeleteUser(deletingUser) && (
              <div className="bg-surface-container-low border border-outline-variant rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-on-surface">
                      <strong>Warning:</strong>{' '}
                      {deletingUser.uid === currentUser?.uid
                        ? 'You cannot delete your own account for security reasons.'
                        : 'Admin users cannot be deleted by regular admins for security reasons.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </DashboardShell>
  );
};

export default AdminUsersPage;

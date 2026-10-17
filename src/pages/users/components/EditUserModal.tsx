import React, { useState, useEffect } from 'react';
import {
  UserIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { User, OrganizerPermissions, DEFAULT_ORGANIZER_PERMISSIONS } from '../../../types';
import { UserWithMetadata } from '../../../services/userService';
import { Modal, Button, Input, SegmentedControl } from '../../../components/UI';
import OrganizerPermissionsEditor from './OrganizerPermissionsEditor';
import toast from 'react-hot-toast';

export interface EditUserModalProps {
  isOpen: boolean;
  user: UserWithMetadata | null;
  onClose: () => void;
  onUpdateUser: (userId: string, updates: Partial<User>) => Promise<void>;
  isSubmitting?: boolean;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onUpdateUser,
  isSubmitting = false,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'organizer' | 'admin'>('organizer');
  const [isActive, setIsActive] = useState<'active' | 'inactive'>('active');
  const [permissions, setPermissions] = useState<OrganizerPermissions>(DEFAULT_ORGANIZER_PERMISSIONS);
  const [copiedUid, setCopiedUid] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setRole(user.role || 'organizer');
      setIsActive(user.isActive !== false ? 'active' : 'inactive');
      setPermissions(user.permissions ?? DEFAULT_ORGANIZER_PERMISSIONS);
      setNameError(undefined);
    }
  }, [user]);

  if (!user) return null;

  const handleCopyUid = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(user.uid).then(() => {
        setCopiedUid(true);
        toast.success('User ID copied to clipboard');
        setTimeout(() => setCopiedUid(false), 2000);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setNameError('Display name is required');
      return;
    }

    const updates: Partial<User> = {
      displayName: displayName.trim(),
      role,
      isActive: isActive === 'active',
    };

    if (role === 'organizer') {
      updates.permissions = permissions;
    }

    await onUpdateUser(user.uid, updates);
  };

  const createdDateStr = user.createdAt?.toDate?.()?.toLocaleDateString() ||
    (user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown');

  const lastLoginStr = user.lastLogin
    ? user.lastLogin instanceof Date
      ? user.lastLogin.toLocaleDateString()
      : 'Never'
    : 'Never';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Edit User Profile"
      size="lg"
      footer={
        <>
          <Button variant="tonal" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-user-form" loading={isSubmitting}>
            Save Changes
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Account Summary Context Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-outline-variant bg-surface-container-low">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="h-12 w-12 rounded-full object-cover border border-outline-variant"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                {user.displayName?.charAt(0)?.toUpperCase() || <UserIcon className="h-6 w-6" />}
              </div>
            )}
            <div>
              <p className="font-semibold text-on-surface text-base">{user.displayName}</p>
              <p className="text-xs text-on-surface-variant font-mono">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={handleCopyUid}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono bg-surface border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors"
              title="Copy User ID"
            >
              {copiedUid ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-success" />
                  <span className="text-success">Copied</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                  <span>ID: {user.uid.slice(0, 8)}...</span>
                </>
              )}
            </button>
            <div className="text-[11px] text-on-surface-variant text-right">
              <div>Joined: {createdDateStr}</div>
              <div>Last active: {lastLoginStr}</div>
            </div>
          </div>
        </div>

        {/* Account Status Switch */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Account Status
          </div>
          <SegmentedControl
            label="Account status"
            value={isActive}
            onChange={(val) => setIsActive(val as 'active' | 'inactive')}
            options={[
              { value: 'active', label: 'Active Account' },
              { value: 'inactive', label: 'Suspended / Inactive' },
            ]}
          />
          <p className="mt-1 text-xs text-on-surface-variant">
            {isActive === 'active'
              ? 'User can sign in and perform their permitted actions.'
              : 'User is locked out from signing in or mutating platform data.'}
          </p>
        </div>

        {/* Display Name */}
        <div>
          <Input
            label="Display Name"
            name="displayName"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (nameError) setNameError(undefined);
            }}
            required
            error={nameError}
            disabled={isSubmitting}
          />
        </div>

        {/* Role Selector via SegmentedControl */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            System Role
          </div>
          <SegmentedControl
            label="User role"
            value={role}
            onChange={(val) => setRole(val as 'organizer' | 'admin')}
            options={[
              { value: 'organizer', label: 'Event Organizer' },
              { value: 'admin', label: 'Administrator' },
            ]}
          />
        </div>

        {/* Granular Permissions (Organizer only) */}
        {role === 'organizer' && (
          <div className="pt-2">
            <OrganizerPermissionsEditor
              value={permissions}
              onChange={setPermissions}
              disabled={isSubmitting}
            />
          </div>
        )}
      </form>
    </Modal>
  );
};

export default EditUserModal;

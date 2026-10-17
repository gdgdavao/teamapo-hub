import React, { useState } from 'react';
import {
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  ClipboardDocumentCheckIcon,
  InformationCircleIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { OrganizerPermissions, ORGANIZER_PERMISSION_PRESETS } from '../../../types';
import { Modal, Button, Input, SegmentedControl } from '../../../components/UI';
import OrganizerPermissionsEditor from './OrganizerPermissionsEditor';
import toast from 'react-hot-toast';

export interface CreateUserData {
  email: string;
  displayName: string;
  role: 'organizer' | 'admin';
  password: string;
  permissions?: OrganizerPermissions;
}

export interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateUser: (userData: CreateUserData) => Promise<void>;
  isSubmitting?: boolean;
}

const generateSecurePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
};

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onCreateUser,
  isSubmitting = false,
}) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'organizer' | 'admin'>('organizer');
  const [permissions, setPermissions] = useState<OrganizerPermissions>(
    ORGANIZER_PERMISSION_PRESETS.full.permissions
  );
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; displayName?: string; password?: string }>({});

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword();
    setPassword(newPassword);
    setShowPassword(true);
    setErrors((prev) => ({ ...prev, password: undefined }));

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(newPassword).then(
        () => {
          setCopiedPassword(true);
          toast.success('Generated password copied to clipboard');
          setTimeout(() => setCopiedPassword(false), 2500);
        },
        () => {
          toast.success('Generated secure password');
        }
      );
    } else {
      toast.success('Generated secure password');
    }
  };

  const validate = (): boolean => {
    const newErrors: { email?: string; displayName?: string; password?: string } = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Initial password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onCreateUser({
      email: email.trim(),
      displayName: displayName.trim(),
      role,
      password,
      permissions: role === 'organizer' ? permissions : undefined,
    });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setEmail('');
    setDisplayName('');
    setPassword('');
    setShowPassword(false);
    setRole('organizer');
    setPermissions(ORGANIZER_PERMISSION_PRESETS.full.permissions);
    setErrors({});
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Create User Account"
      size="lg"
      footer={
        <>
          <Button variant="tonal" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" loading={isSubmitting}>
            Create User
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Account Credentials */}
        <div className="space-y-4">
          <Input
            label="Display Name"
            name="displayName"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
            }}
            placeholder="e.g. Maria Santos"
            required
            error={errors.displayName}
            disabled={isSubmitting}
          />

          <Input
            label="Email Address"
            type="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="maria@gdgdavao.org"
            required
            error={errors.email}
            disabled={isSubmitting}
          />

          {/* Password with generator & eye toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Initial Password <span className="text-error" aria-hidden="true">*</span>
              </span>
              <button
                type="button"
                onClick={handleGeneratePassword}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover focus:outline-none focus-visible:underline transition-colors"
              >
                {copiedPassword ? (
                  <>
                    <ClipboardDocumentCheckIcon className="h-4 w-4 text-success" aria-hidden="true" />
                    <span className="text-success">Copied to clipboard</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                    <span>Generate Secure Password</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <input
                id="create-user-password"
                aria-label="Initial Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="At least 6 characters"
                required
                disabled={isSubmitting}
                aria-invalid={errors.password ? true : undefined}
                className={`md-field font-mono pr-12 ${
                  errors.password ? 'border-error focus:border-error focus:ring-error/25' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p className="mt-1 text-xs text-error font-medium">{errors.password}</p>
            ) : (
              <p className="mt-1 text-xs text-on-surface-variant">
                A password reset invitation will also be emailed to this address.
              </p>
            )}
          </div>
        </div>

        {/* Role Selector via SegmentedControl */}
        <div className="pt-1">
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
          <p className="mt-1.5 text-xs text-on-surface-variant">
            {role === 'organizer'
              ? 'Organizers can manage assigned events, attendees, check-ins, and certificates.'
              : 'Administrators have platform-wide access to all events, users, financial audits, and settings.'}
          </p>
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

        {/* Informational Callout */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-container/30 p-3.5 text-xs text-on-surface">
          <InformationCircleIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-primary">Instant Account Provisioning</p>
            <p className="text-on-surface-variant leading-relaxed">
              This creates the user account in Firebase Authentication with their assigned role and granular permissions.
              They can immediately log in with their credentials or use the password reset link dispatched to their inbox.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreateUserModal;

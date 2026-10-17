import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  EllipsisVerticalIcon,
  PencilIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  EnvelopeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { UserWithMetadata } from '../../../services/userService';

export interface UserRowActionsDropdownProps {
  user: UserWithMetadata;
  canDelete: boolean;
  deleteTooltip?: string;
  onEdit: (user: UserWithMetadata) => void;
  onToggleStatus: (user: UserWithMetadata) => void;
  onSendPasswordReset: (user: UserWithMetadata) => void;
  onDelete: (user: UserWithMetadata) => void;
}

export const UserRowActionsDropdown: React.FC<UserRowActionsDropdownProps> = ({
  user,
  canDelete,
  deleteTooltip,
  onEdit,
  onToggleStatus,
  onSendPasswordReset,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Dismiss on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  // Keyboard navigation within the menu
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDropdown();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const menuItems = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
        if (!menuItems || menuItems.length === 0) return;

        const currentIndex = Array.from(menuItems).indexOf(document.activeElement as HTMLButtonElement);
        let nextIndex = 0;

        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex >= 0 && currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
        }

        menuItems[nextIndex]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

  // Focus first item when opening
  useEffect(() => {
    if (isOpen) {
      const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
      firstItem?.focus();
    }
  }, [isOpen]);

  const handleAction = (callback: (u: UserWithMetadata) => void) => {
    setIsOpen(false);
    callback(user);
  };

  const isActive = user.isActive !== false;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Actions for ${user.displayName}`}
        className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px] rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-actions-menu"
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-outline-variant bg-surface shadow-md py-1 z-30 origin-top-right focus:outline-none animate-scale-in motion-reduce:animate-none"
        >
          {/* Edit user details & permissions */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction(onEdit)}
            className="w-full text-left px-3.5 py-2.5 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2.5 transition-colors duration-fast focus:outline-none focus:bg-surface-container-low"
          >
            <PencilIcon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span>Edit details & permissions</span>
          </button>

          {/* Toggle Active / Deactivate status */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction(onToggleStatus)}
            className="w-full text-left px-3.5 py-2.5 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2.5 transition-colors duration-fast focus:outline-none focus:bg-surface-container-low"
          >
            {isActive ? (
              <>
                <NoSymbolIcon className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
                <span>Deactivate account</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                <span>Reactivate account</span>
              </>
            )}
          </button>

          {/* Send password reset email */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction(onSendPasswordReset)}
            className="w-full text-left px-3.5 py-2.5 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2.5 transition-colors duration-fast focus:outline-none focus:bg-surface-container-low"
          >
            <EnvelopeIcon className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden="true" />
            <span>Send password reset</span>
          </button>

          {/* Destructive divider */}
          <div className="my-1 border-t border-outline-variant/60" role="separator" />

          {/* Delete user account (gated) */}
          <button
            type="button"
            role="menuitem"
            disabled={!canDelete}
            onClick={() => handleAction(onDelete)}
            className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2.5 transition-colors duration-fast focus:outline-none ${
              canDelete
                ? 'text-error hover:bg-error-container/20 focus:bg-error-container/20'
                : 'text-outline/50 cursor-not-allowed hover:bg-transparent'
            }`}
            title={!canDelete ? deleteTooltip || 'Protected account cannot be deleted' : undefined}
          >
            <TrashIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Delete account</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserRowActionsDropdown;

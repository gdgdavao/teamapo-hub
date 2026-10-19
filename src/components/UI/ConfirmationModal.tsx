import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';
import Button from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  /** Disables the confirm action when a pre-flight check proves the call must fail. */
  confirmDisabled?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  isLoading = false,
  confirmDisabled = false
}) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    size="sm"
    title={title}
    footer={
      <>
        <Button variant="outlined" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={type === 'info' ? 'filled' : 'danger'}
          onClick={onConfirm}
          loading={isLoading}
          disabled={confirmDisabled}
        >
          {isLoading ? 'Working...' : confirmText}
        </Button>
      </>
    }
  >
    <div className="flex items-start gap-4">
      <div
        className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full ${
          type === 'danger' ? 'bg-error-container' : type === 'warning' ? 'bg-warning-container' : 'bg-primary-container'
        }`}
      >
        <ExclamationTriangleIcon
          className={`h-5 w-5 ${
            type === 'danger' ? 'text-error' : type === 'warning' ? 'text-on-warning-container' : 'text-primary'
          }`}
          aria-hidden="true"
        />
      </div>
      <p className="text-sm text-on-surface-variant">{message}</p>
    </div>
  </Modal>
);

export default ConfirmationModal;
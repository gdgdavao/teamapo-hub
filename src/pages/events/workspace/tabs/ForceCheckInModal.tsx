import React from 'react';
import { ExclamationTriangleIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Modal } from '../../../../components/UI';
import { Button } from '../../../../components/UI';

interface ForceCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  attendeeName: string;
  eventTitle: string;
  dateWarning: string;
  severity: 'low' | 'medium' | 'high';
}

const ForceCheckInModal: React.FC<ForceCheckInModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  attendeeName,
  eventTitle,
  dateWarning,
  severity
}) => {
  const tone =
    severity === 'high'
      ? { bg: 'bg-secondary-100', text: 'text-secondary-900', icon: 'text-secondary-600' }
      : severity === 'medium'
        ? { bg: 'bg-accent-100', text: 'text-accent-900', icon: 'text-accent-900' }
        : { bg: 'bg-accent-100', text: 'text-accent-900', icon: 'text-accent-900' };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Confirm Check-In"
      size="sm"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={severity === 'high' ? 'danger' : 'filled'} onClick={onConfirm}>
            <CheckIcon className="w-4 h-4" aria-hidden="true" />
            Force Check-In
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary-container rounded-full flex items-center justify-center shrink-0">
            <span className="text-sm font-medium text-primary" aria-hidden="true">
              {attendeeName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-on-surface truncate">{attendeeName}</p>
            <p className="text-sm text-on-surface-variant truncate">{eventTitle}</p>
          </div>
        </div>

        {/* Full border + tint, never a side stripe (DESIGN.md: No Side-Stripe Rule) */}
        <div className={`p-4 rounded-lg border border-outline-variant ${tone.bg}`} role="alert">
          <div className="flex gap-3">
            <ExclamationTriangleIcon className={`h-5 w-5 shrink-0 mt-0.5 ${tone.icon}`} aria-hidden="true" />
            <div>
              <p className={`text-sm font-medium ${tone.text}`}>Event Date Warning</p>
              <p className={`text-sm mt-1 ${tone.text}`}>{dateWarning}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-on-surface-variant">
          Are you sure you want to check in this attendee? This action will be recorded with the current
          timestamp.
        </p>
      </div>
    </Modal>
  );
};

export default ForceCheckInModal;
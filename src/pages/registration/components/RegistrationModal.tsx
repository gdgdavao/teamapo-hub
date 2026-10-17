import React from 'react';
import { Modal } from '../../../components/UI';
import RegistrationForm from './RegistrationForm';
import { Event, FormField } from '../../../types';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  registrationForm: FormField[];
  isPreview?: boolean;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  event,
  registrationForm,
  isPreview = false
}) => {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isPreview ? 'Preview Registration Form' : 'Register for Event'}
      size="lg"
    >
      <p className="mb-4 text-on-surface-variant">
        {event.title}
        {isPreview && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary-container text-on-secondary-container">
            Preview Mode
          </span>
        )}
      </p>
      <RegistrationForm
        event={event}
        registrationForm={registrationForm}
        isPreview={isPreview}
        onSuccess={isPreview ? onClose : undefined}
      />
    </Modal>
  );
};

export default RegistrationModal;

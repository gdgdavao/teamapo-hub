import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import RegistrationForm from '../RegistrationForm';
import { Event, FormField } from '../../../types';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  registrationForm: FormField[];
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  event,
  registrationForm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Modal Content */}
          <div className="bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Register for Event</h2>
                <p className="text-gray-600 mt-1">{event.title}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6">
              <RegistrationForm event={event} registrationForm={registrationForm} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;

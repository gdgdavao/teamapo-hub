import React from 'react';
import { ExclamationTriangleIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
  if (!isOpen) return null;

  const getSeverityStyle = () => {
    switch (severity) {
      case 'high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: 'text-red-500',
          button: 'bg-red-600 hover:bg-red-700'
        };
      case 'medium':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-800',
          icon: 'text-orange-500',
          button: 'bg-orange-600 hover:bg-orange-700'
        };
      default:
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: 'text-yellow-500',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        };
    }
  };

  const style = getSeverityStyle();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          {/* Header */}
          <div className={`px-6 py-4 border-b ${style.border} ${style.bg} rounded-t-lg`}>
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-2 rounded-full bg-white bg-opacity-50`}>
                <ExclamationTriangleIcon className={`h-6 w-6 ${style.icon}`} />
              </div>
              <div className="ml-3">
                <h3 className={`text-lg font-semibold ${style.text}`}>
                  Confirm Check-In
                </h3>
                <p className={`text-sm ${style.text} opacity-80`}>
                  Date Warning Detected
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <div className="space-y-4">
              {/* Attendee Info */}
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {attendeeName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{attendeeName}</p>
                    <p className="text-sm text-gray-500">{eventTitle}</p>
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              <div className={`p-4 rounded-lg border ${style.border} ${style.bg}`}>
                <div className="flex">
                  <ExclamationTriangleIcon className={`h-5 w-5 ${style.icon} flex-shrink-0 mt-0.5`} />
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${style.text}`}>
                      Event Date Warning
                    </p>
                    <p className={`text-sm ${style.text} opacity-80 mt-1`}>
                      {dateWarning}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Text */}
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Are you sure you want to check in this attendee?
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This action will be recorded with the current timestamp.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 px-6 py-4 bg-gray-50 rounded-b-lg">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              <XMarkIcon className="w-4 h-4 inline mr-2" />
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${style.button}`}
            >
              <CheckIcon className="w-4 h-4 inline mr-2" />
              Force Check-In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceCheckInModal;
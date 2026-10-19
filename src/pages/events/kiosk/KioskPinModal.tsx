import React, { useState, useEffect, useCallback } from 'react';
import { LockClosedIcon, KeyIcon, BackspaceIcon } from '@heroicons/react/24/outline';
import { Modal, Button } from '../../../components/UI';
import { playClickFeedback } from '../../../utils/soundEffects';

export interface KioskPinModalProps {
  open: boolean;
  mode: 'setup' | 'verify';
  onSuccess: (pin: string) => void;
  onCancel: () => void;
  /** Function to verify PIN when in 'verify' mode */
  verifyPin?: (pin: string) => boolean;
}

export const KioskPinModal: React.FC<KioskPinModalProps> = ({
  open,
  mode,
  onSuccess,
  onCancel,
  verifyPin,
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Reset state whenever modal opens
  useEffect(() => {
    if (open) {
      setPin('');
      setError(null);
      setIsShaking(false);
    }
  }, [open]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 4) return;
      playClickFeedback();
      setError(null);
      const nextPin = pin + digit;
      setPin(nextPin);

      // Auto-submit on 4th digit
      if (nextPin.length === 4) {
        if (mode === 'setup') {
          onSuccess(nextPin);
        } else if (mode === 'verify') {
          if (verifyPin && verifyPin(nextPin)) {
            onSuccess(nextPin);
          } else {
            setIsShaking(true);
            setError('Incorrect PIN. Please try again.');
            setTimeout(() => {
              setPin('');
              setIsShaking(false);
            }, 600);
          }
        }
      }
    },
    [pin, mode, onSuccess, verifyPin]
  );

  const handleBackspace = useCallback(() => {
    playClickFeedback();
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    playClickFeedback();
    setError(null);
    setPin('');
  }, []);

  // Physical keyboard listener
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleDigit, handleBackspace, onCancel]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={mode === 'setup' ? 'Set Kiosk Exit PIN' : 'Exit Kiosk Mode'}
      size="sm"
      closeOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center py-2 text-center">
        <div className="w-12 h-12 rounded-full bg-primary-container text-primary flex items-center justify-center mb-3">
          {mode === 'setup' ? (
            <KeyIcon className="w-6 h-6" aria-hidden="true" />
          ) : (
            <LockClosedIcon className="w-6 h-6" aria-hidden="true" />
          )}
        </div>

        <p className="text-sm text-on-surface-variant max-w-xs mb-6">
          {mode === 'setup'
            ? 'Set a temporary 4-digit PIN to lock this kiosk station. You will need this PIN to exit back to the organizer workspace.'
            : 'Enter the 4-digit PIN configured for this kiosk session to return to the organizer workspace.'}
        </p>

        {/* 4-digit Indicator Circles */}
        <div
          className={`flex items-center justify-center gap-4 mb-6 ${
            isShaking ? 'animate-micro-shake' : ''
          }`}
          aria-label={`${pin.length} of 4 digits entered`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < pin.length;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-[background-color,transform] duration-200 ${
                  isFilled
                    ? 'bg-primary scale-110'
                    : 'border-2 border-outline-variant bg-surface-container-low'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-error font-medium mb-4 animate-pop-in motion-reduce:animate-none" role="alert">
            {error}
          </p>
        )}

        {/* Numeric On-Screen Keypad for Touch Kiosks */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-xl border border-outline-variant bg-surface text-on-surface text-xl font-semibold hover:bg-surface-container-low active:scale-95 transition-[background-color,transform,box-shadow] shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-xl border border-outline-variant bg-surface text-on-surface-variant text-xs font-semibold uppercase hover:bg-surface-container-low active:scale-95 transition-[background-color,transform,box-shadow] shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
            title="Clear all digits"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-xl border border-outline-variant bg-surface text-on-surface text-xl font-semibold hover:bg-surface-container-low active:scale-95 transition-[background-color,transform,box-shadow] shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-xl border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low active:scale-95 transition-[background-color,transform,box-shadow] shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
            title="Backspace"
            aria-label="Backspace"
          >
            <BackspaceIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default KioskPinModal;

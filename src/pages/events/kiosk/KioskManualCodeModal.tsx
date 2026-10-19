import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TicketIcon,
  EnvelopeIcon,
  BanknotesIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Modal, Button, Input, Badge } from '../../../components/UI';
import { playClickFeedback, playWarningBuzz } from '../../../utils/soundEffects';

export type ManualLookupMode = 'auto' | 'code' | 'email' | 'payment';

export interface KioskManualCodeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<boolean | string | void> | boolean | string | void;
  isLoading?: boolean;
}

/**
 * Normalizes input: strips URL wrappers, removes 'registration:' prefix,
 * trims whitespace, and auto-uppercases ticket code prefixes.
 */
export function normalizeLookupCode(raw: string): string {
  let clean = raw.trim();
  if (!clean) return '';

  // Extract code from URL if attendee pasted a full web link
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const url = new URL(clean);
      const codeParam = url.searchParams.get('code');
      if (codeParam) {
        clean = codeParam;
      } else {
        const pathSegments = url.pathname.split('/').filter(Boolean);
        const last = pathSegments.pop();
        if (last && last !== 'verify') clean = last;
      }
    } catch {
      // Ignore parse failure and proceed with raw
    }
  }

  // Strip scanner 'registration:' namespace prefix
  if (clean.startsWith('registration:')) {
    clean = clean.replace('registration:', '');
  }

  // Auto-uppercase if it starts with reg-
  if (/^reg[-_]/i.test(clean)) {
    clean = clean.toUpperCase();
  }

  return clean;
}

/**
 * Intelligently detects input type based on character content.
 */
export function detectInputType(raw: string): 'code' | 'email' | 'payment' | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return 'email';
  if (/^\d{8,}$/.test(trimmed)) return 'payment';
  if (/^reg[-_]/i.test(trimmed) || /^[a-zA-Z0-9_-]{5,}$/.test(trimmed)) return 'code';
  return null;
}

export const KioskManualCodeModal: React.FC<KioskManualCodeModalProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const [code, setCode] = useState('');
  const [selectedMode, setSelectedMode] = useState<ManualLookupMode>('auto');
  const [error, setError] = useState<string | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check clipboard support on mount
  useEffect(() => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.readText === 'function'
    ) {
      setCanPaste(true);
    }
  }, []);

  // Reset state and focus input when modal opens
  useEffect(() => {
    if (open) {
      setCode('');
      setSelectedMode('auto');
      setError(null);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const detectedType = detectInputType(code);
  const effectiveMode: 'code' | 'email' | 'payment' | 'auto' =
    selectedMode !== 'auto' ? selectedMode : detectedType || 'auto';

  const handleModeSelect = useCallback(
    (mode: ManualLookupMode) => {
      playClickFeedback();
      setSelectedMode((prev) => (prev === mode ? 'auto' : mode));
      setError(null);
      inputRef.current?.focus();
    },
    []
  );

  const handleClear = useCallback(() => {
    playClickFeedback();
    setCode('');
    setSelectedMode('auto');
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          playClickFeedback();
          const clean = normalizeLookupCode(text);
          setCode(clean);
          setError(null);
        }
      }
    } catch {
      inputRef.current?.focus();
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = normalizeLookupCode(code);
    if (!cleanCode) {
      playWarningBuzz();
      setError('Please enter your registration code, email, or payment reference.');
      return;
    }

    setError(null);
    try {
      const result = await onSubmit(cleanCode);
      if (typeof result === 'string') {
        playWarningBuzz();
        setError(result);
      } else if (result === false) {
        playWarningBuzz();
        setError(
          'Could not find a valid registration for this code or email. Please verify your details or ask staff.'
        );
      }
    } catch (err: unknown) {
      playWarningBuzz();
      setError(err instanceof Error ? err.message : 'Check-in failed. Please try again.');
    }
  };

  // Determine guidance hints and placeholders
  let placeholder = 'Enter ticket code, email, or payment reference...';
  let guidanceHint = 'Enter your ticket confirmation code, registered email, or GCash/Maya reference.';

  if (effectiveMode === 'email') {
    placeholder = 'e.g. attendee@gdgdavao.org';
    guidanceHint = 'Verifying registration matching this registered email address.';
  } else if (effectiveMode === 'code') {
    placeholder = 'e.g. REG-12345 or confirmation code';
    guidanceHint = 'Check your ticket confirmation email or digital event badge.';
  } else if (effectiveMode === 'payment') {
    placeholder = 'e.g. 100234567891 (GCash / Maya reference)';
    guidanceHint = 'Transaction reference number from your payment receipt.';
  }

  // Format detected badge indicator
  let detectedBadge: React.ReactNode = null;
  if (detectedType === 'email') {
    detectedBadge = <Badge tone="info">Email Detected</Badge>;
  } else if (detectedType === 'code') {
    detectedBadge = <Badge tone="info">Ticket Code Detected</Badge>;
  } else if (detectedType === 'payment') {
    detectedBadge = <Badge tone="neutral">Payment Ref Detected</Badge>;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manual Check-In"
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-xs w-full">
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto min-h-control"
          >
            Cancel
          </Button>
          <Button
            variant="filled"
            onClick={() => handleSubmit()}
            loading={isLoading}
            disabled={!code.trim() || isLoading}
            icon={<CheckCircleIcon className="w-5 h-5" aria-hidden="true" />}
            className="w-full sm:w-auto min-h-control font-semibold"
          >
            Verify & Check In
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* Google 4-Color Accent Hairline */}
        <div className="h-1 w-full flex rounded-full overflow-hidden" aria-hidden="true">
          <div className="h-full w-1/4 bg-[#4285F4]" />
          <div className="h-full w-1/4 bg-[#EA4335]" />
          <div className="h-full w-1/4 bg-[#FBBC04]" />
          <div className="h-full w-1/4 bg-[#34A853]" />
        </div>

        {/* Modal Description */}
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Camera unable to read your badge? Enter your details below for instant self-service verification.
        </p>

        {/* Format Selector Quick Chips */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Input Format
          </label>
          <div className="flex flex-wrap items-center gap-xs" role="group" aria-label="Input format selector">
            <button
              type="button"
              onClick={() => handleModeSelect('code')}
              aria-pressed={effectiveMode === 'code'}
              className={`min-h-control h-control px-sm rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors duration-short2 ease-emphasized-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                effectiveMode === 'code'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <TicketIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ticket Code</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSelect('email')}
              aria-pressed={effectiveMode === 'email'}
              className={`min-h-control h-control px-sm rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors duration-short2 ease-emphasized-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                effectiveMode === 'email'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <EnvelopeIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Email Address</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSelect('payment')}
              aria-pressed={effectiveMode === 'payment'}
              className={`min-h-control h-control px-sm rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors duration-short2 ease-emphasized-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                effectiveMode === 'payment'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <BanknotesIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Payment Ref</span>
            </button>
          </div>
        </div>

        {/* Input Field with Action Button Adornments */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="relative">
            <Input
              ref={inputRef}
              label={
                effectiveMode === 'email'
                  ? 'Registered Email'
                  : effectiveMode === 'code'
                  ? 'Registration Code'
                  : effectiveMode === 'payment'
                  ? 'Payment Transaction Reference'
                  : 'Code, Email, or Payment Ref'
              }
              placeholder={placeholder}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              mono={effectiveMode === 'code' || effectiveMode === 'payment'}
              aria-invalid={Boolean(error)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className={`pr-20 text-base sm:text-lg font-medium ${
                error ? '!border-error focus:!border-error focus:!ring-error/25' : ''
              }`}
              aria-describedby="manual-checkin-hint"
            />
            {/* Clear or Paste Action Button */}
            <div className="absolute right-2 top-[34px] flex items-center gap-1">
              {code ? (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear input"
                  title="Clear input"
                  className="h-control min-h-control w-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-short2 ease-emphasized-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                </button>
              ) : canPaste ? (
                <button
                  type="button"
                  onClick={handlePaste}
                  aria-label="Paste from clipboard"
                  title="Paste from clipboard"
                  className="h-control min-h-control px-2.5 flex items-center gap-1 rounded-lg text-primary hover:bg-primary-container/40 text-xs font-semibold transition-colors duration-short2 ease-emphasized-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ClipboardDocumentCheckIcon className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Hint & Detected Format Strip */}
          <div className="flex items-center justify-between text-xs min-h-[22px] px-1 text-on-surface-variant">
            <span id="manual-checkin-hint" className="truncate">
              {guidanceHint}
            </span>
            {code.trim() && detectedBadge && (
              <span className="shrink-0 ml-2">
                {detectedBadge}
              </span>
            )}
          </div>
        </form>

        {/* Error Feedback Alert Banner */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-error/30 bg-error-container p-3.5 text-on-error-container flex items-start gap-3 transition-opacity duration-short2"
          >
            <ExclamationCircleIcon className="h-5 w-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 text-left min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-error">
                Check-In Unsuccessful
              </p>
              <p className="text-sm font-medium text-on-error-container leading-snug">
                {error}
              </p>
              <p className="text-xs text-on-error-container/85 pt-0.5">
                Please double-check your code or approach the registration desk for assistance.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default KioskManualCodeModal;

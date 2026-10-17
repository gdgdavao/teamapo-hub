import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Cap the panel width; defaults suit most dialogs. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  closeOnBackdrop?: boolean;
  className?: string;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-6xl',
} as const;

/**
 * Built on the native <dialog> element, which supplies the focus trap, Escape
 * handling, inert background and ::backdrop for free. Hand-rolling those was
 * the reason the 26 previous overlays had no dialog semantics at all, and it is
 * also why they all scrolled underneath themselves on iOS: `overflow:hidden` on
 * the body is ignored by iOS Safari, whereas `showModal()` makes the document
 * genuinely inert.
 */
const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className = '',
}) => {
  const ref = useRef<HTMLDialogElement>(null);

  /**
   * Drive the exit animation from React instead of relying on
   * `transition-behavior: allow-discrete` + `@starting-style`.
   *
   * Those two features are what let a <dialog> animate *out* while it leaves
   * the top layer, and they are recent: Chrome 117, Firefox 129, Safari 17.5.
   * Below that the UA hides the dialog the instant it closes, so on Safari 16
   * and iOS 17.0-17.4 every dialog in this product appeared and vanished with no
   * transition at all, and the backdrop never faded.
   *
   * Holding `open` true for one exit duration and then closing covers every
   * engine. @starting-style is still declared in index.css, but now it is a
   * progressive enhancement for the entrance rather than load-bearing.
   */
  const EXIT_MS = 180; // must match --motion-duration-exit
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(open);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (timer.current) clearTimeout(timer.current);
      setExiting(false);
      setMounted(true);
      return;
    }
    if (!mounted) return;
    // Not exiting: this is a fresh close request, so play the exit.
    setExiting(true);
    timer.current = setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, EXIT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, mounted]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (mounted && !el.open) el.showModal();
    if (!mounted && el.open) el.close();
  }, [mounted]);

  // `cancel` fires on Escape; keep React state in sync.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener('cancel', handleCancel);
    return () => el.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onClick={(e) => {
        // Clicks land on the dialog itself only when they hit the backdrop.
        if (closeOnBackdrop && e.target === ref.current) onClose();
      }}
      className={`app-dialog w-[calc(100vw-2rem)] ${sizes[size]} rounded-xl bg-surface-container-lowest p-0 shadow-elevation-3 ${
        exiting ? 'is-exiting' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-sm border-b border-outline-variant px-md py-sm">
        <h2 id="modal-title" className="text-lg font-semibold text-on-surface">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="md-state-layer -mr-2xs flex h-control w-control shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-short2 ease-emphasized-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* dvh, not vh: a 70vh body on iOS measures against the tallest viewport,
          so the scroll region ran past the bottom of the screen by 60-100px and
          the last field of a long form was unreachable. */}
      <div className="max-h-[70vh] max-h-[70dvh] overflow-y-auto px-md py-sm">{children}</div>

      {footer && (
        <div className="flex flex-wrap justify-end gap-xs border-t border-outline-variant px-md py-sm">
          {footer}
        </div>
      )}
    </dialog>
  );
};

export default Modal;
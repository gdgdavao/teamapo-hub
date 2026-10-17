import React from 'react';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * AppToaster: Accessible, responsive Material 3 toast container for TeamApo Hub.
 *
 * Visual & Interaction Invariants:
 * - Position adapts responsively: top-center on mobile viewports (< 640px)
 *   with safe-area clearance for device notches and dynamic islands;
 *   top-right on desktop viewports (>= 640px).
 * - Safe-area aware: container offsets respect `env(safe-area-inset-*)`.
 * - WCAG 2.2 AA touch target: Dedicated dismiss button carries min-h-control min-w-control
 *   (48px x 48px) tap target, plus tap-to-dismiss on the toast card.
 * - Material 3 elevation & semantic tokens: No colored side-stripe borders (banned).
 * - ARIA live regions: error toasts announce assertively (`role="alert"`),
 *   while success/info/loading announce politely (`role="status"`).
 * - Cross-browser: WebKit (-webkit-backdrop-filter), Chrome, Firefox.
 */
export const AppToaster: React.FC = () => {
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const position = isDesktop ? 'top-right' : 'top-center';

  return (
    <Toaster
      position={position}
      containerStyle={{
        top: 'max(1rem, env(safe-area-inset-top, 1rem))',
        left: 'max(1rem, env(safe-area-inset-left, 1rem))',
        right: 'max(1rem, env(safe-area-inset-right, 1rem))',
        bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        zIndex: 1400,
      }}
      toastOptions={{
        duration: 4000,
        className: 'toast-bar',
        style: {
          fontFamily: "'Google Sans', Roboto, sans-serif",
          maxWidth: 'min(92vw, 440px)',
        },
        success: {
          duration: 4000,
          className: 'toast-bar toast-success',
          iconTheme: {
            primary: '#186a3b',
            secondary: '#ffffff',
          },
          ariaProps: {
            role: 'status',
            'aria-live': 'polite',
          },
        },
        error: {
          duration: 6000,
          className: 'toast-bar toast-error',
          iconTheme: {
            primary: '#b3261e',
            secondary: '#ffffff',
          },
          ariaProps: {
            role: 'alert',
            'aria-live': 'assertive',
          },
        },
        loading: {
          className: 'toast-bar toast-loading',
          iconTheme: {
            primary: '#0b57d0',
            secondary: '#d2e3fc',
          },
          ariaProps: {
            role: 'status',
            'aria-live': 'polite',
          },
        },
        blank: {
          duration: 4000,
          className: 'toast-bar toast-blank',
          ariaProps: {
            role: 'status',
            'aria-live': 'polite',
          },
        },
      }}
    >
      {(t) => (
        <ToastBar
          toast={t}
          style={{
            ...t.style,
            padding: 0,
            background: 'transparent',
            boxShadow: 'none',
          }}
        >
          {({ icon, message }) => (
            <div
              className={`toast-inner toast-${t.type} group flex items-center w-full px-3 py-2 rounded-xl border select-none transition-shadow ${
                t.type !== 'loading' ? 'cursor-pointer' : ''
              }`}
              onClick={() => {
                if (t.type !== 'loading') {
                  toast.dismiss(t.id);
                }
              }}
            >
              <div className="toast-icon flex items-center justify-center shrink-0 mr-2.5">
                {icon || (
                  <svg
                    className="w-5 h-5 text-brand shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>
              <div className="toast-message flex-1 min-w-0 text-sm font-medium leading-snug">
                {message}
              </div>
              {t.type !== 'loading' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.dismiss(t.id);
                  }}
                  className="toast-dismiss min-h-control min-w-control -mr-2 ml-1 inline-flex items-center justify-center rounded-lg text-current opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current transition-opacity cursor-pointer"
                  aria-label="Dismiss notification"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
};

export default AppToaster;

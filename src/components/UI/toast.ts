import originalToast from 'react-hot-toast';
import type { ToastOptions, ValueOrFunction, Renderable } from 'react-hot-toast';

/**
 * Toast deduplication and double-trigger prevention engine.
 *
 * Prevents identical toasts from double triggering in rapid succession
 * (caused by React 18/19 StrictMode double useEffect execution, double clicks,
 * duplicate event dispatchers, or rapid re-renders).
 */

interface TriggerRecord {
  time: number;
  toastId: string;
}

const recentTriggers = new Map<string, TriggerRecord>();
const DEDUPE_WINDOW_MS = 1200; // 1.2s window to suppress rapid identical triggers

export function getToastDedupeKey(
  type: string,
  message: ValueOrFunction<Renderable, any>,
  opts?: ToastOptions
): string {
  if (opts?.id) return `${type}:id:${opts.id}`;
  if (typeof message === 'string') return `${type}:msg:${message.trim()}`;
  if (typeof message === 'number') return `${type}:msg:${message}`;
  return '';
}

export function checkToastSuppression(
  type: string,
  message: ValueOrFunction<Renderable, any>,
  opts?: ToastOptions
): { suppressed: boolean; toastId?: string; key: string } {
  const key = getToastDedupeKey(type, message, opts);
  if (!key) return { suppressed: false, key: '' };

  const now = Date.now();
  const record = recentTriggers.get(key);

  if (record && now - record.time < DEDUPE_WINDOW_MS) {
    return { suppressed: true, toastId: record.toastId, key };
  }

  // Periodically clean up entries older than 10 seconds to prevent unbounded Map growth
  if (recentTriggers.size > 50) {
    for (const [k, r] of recentTriggers.entries()) {
      if (now - r.time > 10000) recentTriggers.delete(k);
    }
  }

  return { suppressed: false, key };
}

export function recordToastTrigger(key: string, toastId: string): void {
  if (!key) return;
  recentTriggers.set(key, { time: Date.now(), toastId });
}

export function shouldSuppressToast(
  type: string,
  message: ValueOrFunction<Renderable, any>,
  opts?: ToastOptions
): boolean {
  const { suppressed, key } = checkToastSuppression(type, message, opts);
  if (!suppressed && key) {
    recordToastTrigger(key, opts?.id || key);
  }
  return suppressed;
}

/**
 * Resets the deduplication window for testing or explicit toast dismissal.
 */
export function resetToastDeduplication(idOrKey?: string): void {
  if (idOrKey) {
    const cleanTarget = idOrKey.replace(/^toast-[a-z]+-/, '');
    for (const [key, record] of recentTriggers.entries()) {
      if (key.includes(idOrKey) || key.includes(cleanTarget) || record.toastId === idOrKey) {
        recentTriggers.delete(key);
      }
    }
  } else {
    recentTriggers.clear();
  }
}

// Resilient extraction of react-hot-toast functions (supporting full library and test mocks)
const rawCandidate: any = originalToast;
const isCallable = typeof rawCandidate === 'function';

const safeBind = (fn: any) => {
  return typeof fn === 'function' && isCallable ? fn.bind(rawCandidate) : fn;
};

const rawError = safeBind(rawCandidate?.error);
const rawSuccess = safeBind(rawCandidate?.success);
const rawLoading = safeBind(rawCandidate?.loading);
const rawCustom = safeBind(rawCandidate?.custom);
const rawDismiss = safeBind(rawCandidate?.dismiss);
const rawRemove = safeBind(rawCandidate?.remove);
const rawPromise = safeBind(rawCandidate?.promise);

function wrapMethod(
  type: 'success' | 'error' | 'loading' | 'blank' | 'custom',
  originalFn?: (message: ValueOrFunction<Renderable, any>, opts?: ToastOptions) => string
) {
  return (message: ValueOrFunction<Renderable, any>, opts?: ToastOptions): string => {
    const check = checkToastSuppression(type, message, opts);
    if (check.suppressed && check.toastId) {
      return check.toastId;
    }

    let resultId = '';
    if (typeof originalFn === 'function') {
      resultId = opts !== undefined ? originalFn(message, opts) : originalFn(message);
    } else {
      resultId = opts?.id || check.key;
    }

    if (check.key) {
      recordToastTrigger(check.key, resultId);
    }
    return resultId;
  };
}

const wrappedDismiss = (toastId?: string) => {
  resetToastDeduplication(toastId);
  return typeof rawDismiss === 'function' ? rawDismiss(toastId) : undefined;
};

function patchTargetMethod(
  target: any,
  methodName: 'error' | 'success' | 'loading' | 'custom'
) {
  const rawFn = target?.[methodName];
  if (typeof rawFn !== 'function') return;

  if (rawFn._isMockFunction || rawFn.mock) {
    // Vitest / Jest mock spy: preserve spy identity by wrapping implementation
    const origImpl = rawFn.getMockImplementation?.() || (() => '');
    rawFn.mockImplementation((message: any, opts: any) => {
      const check = checkToastSuppression(methodName, message, opts);
      if (check.suppressed && check.toastId) {
        return check.toastId;
      }

      const resultId = opts !== undefined ? origImpl(message, opts) : origImpl(message);
      if (check.key) {
        recordToastTrigger(check.key, resultId);
      }
      return resultId;
    });
  } else {
    // Real runtime method: replace with wrapped function
    target[methodName] = wrapMethod(methodName, rawFn);
  }
}

// Global in-place monkey-patch for react-hot-toast's toast singleton
let isPatched = false;

export function installToastDeduplication(): void {
  if (isPatched || !rawCandidate) return;

  try {
    patchTargetMethod(rawCandidate, 'error');
    patchTargetMethod(rawCandidate, 'success');
    patchTargetMethod(rawCandidate, 'loading');
    patchTargetMethod(rawCandidate, 'custom');

    if (typeof rawCandidate.dismiss === 'function') {
      const origDismiss = rawCandidate.dismiss;
      if (origDismiss._isMockFunction || origDismiss.mock) {
        const origImpl = origDismiss.getMockImplementation?.() || (() => {});
        origDismiss.mockImplementation((toastId?: string) => {
          resetToastDeduplication(toastId);
          return origImpl(toastId);
        });
      } else {
        rawCandidate.dismiss = (toastId?: string) => {
          resetToastDeduplication(toastId);
          return origDismiss(toastId);
        };
      }
    }

    isPatched = true;
  } catch {
    // Graceful fallback if runtime prevents property mutation
  }
}

// Automatically install on module load
installToastDeduplication();

// Create the unified, typed toast wrapper function
const customToast = ((message: ValueOrFunction<Renderable, any>, opts?: ToastOptions): string => {
  const check = checkToastSuppression('blank', message, opts);
  if (check.suppressed && check.toastId) {
    return check.toastId;
  }

  let resultId = '';
  if (isCallable) {
    resultId = opts !== undefined ? rawCandidate(message, opts) : rawCandidate(message);
  } else {
    resultId = opts?.id || check.key;
  }

  if (check.key) {
    recordToastTrigger(check.key, resultId);
  }
  return resultId;
}) as any;

// Assign methods to customToast
customToast.error = wrapMethod('error', rawError);
customToast.success = wrapMethod('success', rawSuccess);
customToast.loading = wrapMethod('loading', rawLoading);
customToast.custom = wrapMethod('custom', rawCustom);
customToast.dismiss = wrappedDismiss;
customToast.remove = rawRemove;
customToast.promise = rawPromise;

export { customToast as toast };
export default customToast;

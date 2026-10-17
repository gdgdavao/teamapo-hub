import { useMediaQuery } from './useMediaQuery';

/**
 * True when the visitor has asked the OS to reduce motion.
 *
 * JavaScript is only needed for the cases CSS cannot express on its own, such
 * as skipping an IntersectionObserver reveal entirely. Purely decorative motion
 * should still be handled in CSS via the `motion-reduce:` variant, so that it
 * degrades without JavaScript.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

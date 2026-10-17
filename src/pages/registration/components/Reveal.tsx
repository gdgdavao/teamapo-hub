import React, { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /**
   * Stagger step in milliseconds. Multiply by the item's index when revealing a
   * list; the cap below keeps a long list from feeling like a queue.
   */
  delay?: number;
  /** Distance to travel, in pixels. */
  distance?: number;
}

const MAX_DELAY = 240;

/**
 * Scroll-triggered reveal for the public event page.
 *
 * This is the one surface where reveal-on-scroll is the right call: an attendee
 * landing from a shared link is reading a flyer, not operating a tool, so
 * content arriving as they reach it is a legibility win rather than friction.
 * It is deliberately absent from the dashboards, where the user is in a task.
 *
 * Progressive enhancement, in order:
 *   1. No JavaScript, or IntersectionObserver missing: content renders visible.
 *   2. Reduced motion: content renders visible, nothing is observed.
 *   3. Otherwise: hidden until it first intersects, then revealed once and
 *      unobserved, so scrolling back up never re-hides anything.
 *
 * The hidden offset is applied in a layout effect, which runs before paint, so
 * there is no flash of visible-then-hidden content.
 */
const Reveal: React.FC<RevealProps> = ({ children, className = '', delay = 0, distance = 14 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const reduceMotion = useReducedMotion();

  const canReveal = typeof IntersectionObserver !== 'undefined' && !reduceMotion;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!canReveal || !el) return;

    // Already on screen at mount (or the observer is unavailable): show it and
    // skip the animation rather than making the visitor wait for a scroll.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [canReveal]);

  return (
    <div
      ref={ref}
      className={className}
      style={
        canReveal && !shown
          ? {
              opacity: 0,
              transform: `translateY(${distance}px)`,
              transition: `opacity var(--motion-duration-slow) var(--motion-ease-expo) ${Math.min(delay, MAX_DELAY)}ms, transform var(--motion-duration-slow) var(--motion-ease-expo) ${Math.min(delay, MAX_DELAY)}ms`
            }
          : {
              opacity: 1,
              transform: 'translateY(0)',
              transition: `opacity var(--motion-duration-slow) var(--motion-ease-expo) ${Math.min(delay, MAX_DELAY)}ms, transform var(--motion-duration-slow) var(--motion-ease-expo) ${Math.min(delay, MAX_DELAY)}ms`
            }
      }
    >
      {children}
    </div>
  );
};

export default Reveal;

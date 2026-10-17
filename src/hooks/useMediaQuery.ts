import { useEffect, useState } from 'react';

/**
 * SSR-safe matchMedia. Used to mount a component in only one of two CSS-toggled
 * containers — hiding with a class still mounts the subtree, which for anything
 * holding a Firestore onSnapshot listener doubles the subscriptions.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

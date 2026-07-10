import { useSyncExternalStore } from 'react';

/**
 * Reactive `window.matchMedia(query)` boolean. Subscribes to the query's
 * 'change' event via useSyncExternalStore so a layout branch (e.g. mobile vs
 * desktop in App.tsx) re-renders exactly when the match state flips — a
 * resize across the breakpoint, not just the initial mount. The server
 * snapshot is `false` (no window at SSR time); this app has none, but the
 * hook stays correct if that ever changes.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

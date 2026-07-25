import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Keep Tab focus inside an open modal (D46).
 *
 * The dialogs already declare `aria-modal="true"`, which tells a screen reader
 * the rest of the page is inert — but the attribute changes nothing about where
 * Tab actually goes, so focus walked straight out into the board behind the
 * overlay. This wraps Tab and Shift+Tab around the container's own focusable
 * elements, making the promise true.
 *
 * Escape and initial/restored focus are each dialog's own business; this hook
 * only handles the wrap.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = ref.current;
      if (!container) return;

      // Re-queried on every Tab: dialog contents change (a form appears, a
      // button becomes disabled), so a list captured on mount would go stale.
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        // Nothing to focus inside — still swallow Tab so focus can't escape.
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Focus outside the dialog entirely (e.g. still on <body> right after
      // open) counts as "before the first element", so Tab enters the dialog.
      if (!container.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [ref]);
}

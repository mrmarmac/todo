import type { KeyboardEvent } from 'react';

/**
 * Card-scoped keyboard shortcuts (plan §2). Task cards are focusable
 * (`tabIndex={0}`); these helpers act only when the card `<li>` itself holds
 * focus — never when focus is on a child control (the activate-title button,
 * a subtask input, etc.) — so we don't hijack their native keys.
 */

/** True when the keydown originated on the card element itself, not a child. */
export function isCardTarget(e: KeyboardEvent<HTMLLIElement>): boolean {
  return e.target === e.currentTarget;
}

/**
 * Roving focus: ArrowUp/ArrowDown move to the previous/next sibling card in the
 * same column. Returns true if the key was handled.
 */
export function handleArrowNav(e: KeyboardEvent<HTMLLIElement>): boolean {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;
  const li = e.currentTarget;
  const sibling = e.key === 'ArrowDown' ? li.nextElementSibling : li.previousElementSibling;
  if (sibling instanceof HTMLElement && sibling.tagName === 'LI') {
    sibling.focus();
    e.preventDefault();
    return true;
  }
  // Prevent page scroll even at the ends of the list.
  e.preventDefault();
  return true;
}

/** True for the Delete/Backspace keys used to remove a card. */
export function isDeleteKey(key: string): boolean {
  return key === 'Delete' || key === 'Backspace';
}

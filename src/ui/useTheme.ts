import { useCallback, useEffect, useState } from 'react';
import { readLocal, writeLocal, removeLocal } from '../core/safeStorage';

/**
 * Light/dark theme preference (D45).
 *
 * `styles.css` has carried `:root[data-theme='dark']` and `[data-theme='light']`
 * blocks since the Bauhaus rebuild, but nothing ever set the attribute — this
 * hook is the missing half. `'system'` removes the attribute entirely so the
 * `@media (prefers-color-scheme: dark)` block governs; the two explicit values
 * stamp the attribute, and the attribute selectors outrank the media query in
 * both directions.
 */

/** localStorage key holding the theme preference. */
export const THEME_KEY = 'todo-pwa/theme/v1';

/** `'system'` follows the OS preference; the others pin the theme. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** The order the toggle cycles through. */
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function loadTheme(): ThemePreference {
  const raw = readLocal(THEME_KEY);
  return isThemePreference(raw) ? raw : 'system';
}

/** Human-readable label for the current preference, for the button's tooltip. */
export function themeLabel(theme: ThemePreference): string {
  switch (theme) {
    case 'system':
      return 'System theme';
    case 'light':
      return 'Light theme';
    case 'dark':
      return 'Dark theme';
  }
}

export interface UseThemeResult {
  theme: ThemePreference;
  /** Advance to the next preference (system → light → dark → system). */
  cycleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setTheme] = useState<ThemePreference>(loadTheme);

  // Mirror the preference onto <html> so the CSS attribute blocks apply, and
  // persist it. Removing the attribute (rather than setting 'system') is what
  // hands control back to prefers-color-scheme.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      delete root.dataset.theme;
      removeLocal(THEME_KEY);
    } else {
      root.dataset.theme = theme;
      writeLocal(THEME_KEY, theme);
    }
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
  }, []);

  return { theme, cycleTheme };
}

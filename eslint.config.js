import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Lint config (D47).
 *
 * The point of adding a linter to this project is `react-hooks/exhaustive-deps`
 * — a stale-dependency bug in `useGistSync` is exactly what let a
 * development-only effect re-run push spurious data at the user's real gist, and
 * that class of mistake is invisible to `tsc` and to the core unit tests. The
 * rest of the config is deliberately thin: recommended rules only, no style
 * opinions (the codebase is already internally consistent and a formatter war
 * is not the goal).
 */
export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Prefixing an intentionally-unused binding with _ is the escape hatch.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The service worker is hand-rolled plain JS running in a worker global
    // (D17) — it is not part of the typed src/ tree.
    files: ['public/sw.js'],
    languageOptions: {
      globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly' },
    },
  },
);

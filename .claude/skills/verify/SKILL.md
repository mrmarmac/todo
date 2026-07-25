---
name: verify
description: Build/launch/drive recipe for verifying changes to this PWA todo app end-to-end in a browser.
---

# Verifying this app

## Launch

```bash
npm ci                      # if node_modules is missing
npm run dev -- --port 5173 --strictPort   # app serves at http://localhost:5173/todo/  (note the /todo/ base!)
```

`vite.config.ts` sets `base: '/todo/'` — hitting `/` returns a 302 to `/todo/`.

## Drive (headless browser)

Playwright is not a repo dependency. Install it in a scratch dir and launch the
pre-installed Chromium explicitly (the pinned headless-shell revision may not
match what's on disk):

```js
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
```

Useful selectors — prefer the class over a placeholder/title match, since the
copy changes more often than the structure:
- Add form: `.add__input` (+ `.add__submit`, `.add__recur` for the Repeat toggle,
  `.add__date`). The placeholder is `New task… “fri”, “+3d”` with curly quotes,
  so an exact `input[placeholder="New task…"]` match finds nothing.
- Task rows: `.col--master .task`, `.col--today .task`, `.col--done .task`
- Row actions: `button[aria-label="…"]` within a row — `Move to Today`,
  `Complete`, `Remove from Today`, `Delete`, `Edit`, `Add subtask`, `Undo (back
  to Today)`. **These need a `.hover()` on the row first** — see Gotchas.
- Overflow menu: `.app__menu button[aria-label="More actions"]`, items in
  `.app__menu-list` (Export / Import / Sync…). There is no `.app__menu-btn`.
- Theme toggle: `button[aria-label*="theme"]` — cycles system → light → dark,
  mirrored onto `document.documentElement.dataset.theme` (absent = system).
- Sync dialog: `.sync-settings`, token input `input[aria-label="GitHub personal access token"]`
- Header sync dot: `.app__sync-indicator` (title = `Sync: <status>`)
- Modals: `.confirm-dialog`, `.sync-settings`, `.shortcut-help` (open with `?`).
  Escape closes each; Tab is trapped inside (D46).
- Storage-failure band: `.app__storage-warning` (D41)

Confirms are the **in-app** `ConfirmDialog`, not `window.confirm` — a
`page.on('dialog', …)` handler will never fire. Click the button by its label
inside `.confirm-dialog` (e.g. `Replace everything`, `Start new day`, `Cancel`).

Button labels are uppercased by CSS (`text-transform`), so `innerText` comes
back as `"START NEW DAY"` while the DOM text is `"Start new day"`. Playwright's
`:has-text()` is case-insensitive and matches either way; an exact `toEqual`
against `allInnerTexts()` will not.

## Gist sync flows

Sync talks to `https://api.github.com` (`/gists`, `/gists/:id`). Mock it with
`context.route('https://api.github.com/**', ...)` backed by a tiny in-memory
store shared across contexts to simulate multiple devices. Endpoints used:
GET `/gists?per_page=100&page=N` (discovery), POST `/gists` (create),
GET `/gists/:id` (pull / pre-push check), PATCH `/gists/:id` (push).
Push is debounced 2.5s after the last edit — wait ~4s before asserting.
A worked example lives in the session that added sync: two contexts, conflict
simulation by bumping the stored envelope's `modifiedAt`, offline via
`route.abort('internetdisconnected')`.

## Gotchas

- **Row actions are hover-gated.** On hover-capable devices (which is what
  Playwright reports) `.task__actions` is `opacity: 0; pointer-events: none`
  until the row is hovered (D40). Clicking one directly times out with
  "`<section class="col col--master">` intercepts pointer events" even though
  the button reports visible and enabled. Hover the row first:

  ```js
  const clickAction = async (row, label) => {
    await row.hover();
    await row.locator(`button[aria-label="${label}"]`).click();
  };
  ```

- Focus/visibility reconciles are throttled to one per 30s.
- A recurring master's "Move to Today" is **disabled while its day-copy is in
  Today** (D43), so a second click is a no-op by design, not a broken test.
- `localStorage` keys: `todo-pwa/state/v1` (app state), `todo-pwa/sync/v1`
  (token + gistId + lastSyncedAt), `todo-pwa/sync/dirty/v1` (unsynced-changes
  flag), `todo-pwa/theme/v1` (theme preference).
- To exercise the storage-failure path (D41), throw from `setItem` via
  `page.addInitScript` before navigating:

  ```js
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith('todo-pwa/')) throw new DOMException('full', 'QuotaExceededError');
      return real.call(this, k, v);
    };
  });
  ```

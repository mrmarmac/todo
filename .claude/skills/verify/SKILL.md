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
- Task rows: `.col--master .task`, `.col--today .task`, `.col--done .task`.
  Each row's visible content is wrapped in `.task__surface` (D53) — the swipe
  translates that, not the `<li>`.
- Row interactions (D51/D52/D53):
  - **Complete** a Today task: click `.task__check input[type=checkbox]` — it
    plays a ~0.4s exit animation, so `waitForTimeout(~600ms)` before asserting
    it landed in Done. Done rows uncomplete via the same checkbox.
  - **Set active** (Today): the colour mark dot `button.task__mark`.
  - **Edit**: click the card *body* (a spot that isn't a control) to open
    `.edit-panel`; inside it the move button is `.edit-panel__move`
    (`--today`/`--master` variants), delete is `.edit-panel__delete`, Done is
    `.edit-panel__done`, reorder chevrons are `.icon-btn`.
  - **Move to Today** (Master, desktop): `button.task__move` (`aria-label="Move
    to Today"`) — **hover-gated**, see Gotchas. Disabled for a recurring master
    with a live day-copy (D43).
  - **Move by swipe** (touch): see the touch-context recipe in Gotchas.
- Add-form token pill: `.add__token` (the ochre highlight under a recognised
  date token); the resolved-date echo is `.add__hint-due`.
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

- **The Master "Move to Today" control is hover-gated** (D53). `.task__move` is
  `opacity: 0; pointer-events: none` until the row is hovered (and only inside
  `@media (hover: hover)`, which is what Playwright reports). Hover the row
  first:

  ```js
  const move = async (row) => {
    await row.hover();
    await row.locator('button.task__move').click();
  };
  ```

- **Swipe gestures are touch-only** (D53). Use a `hasTouch: true` context and
  dispatch synthetic `PointerEvent`s with `pointerType: 'touch'` (a real
  horizontal drag on the row). Declare horizontal intent by moving `>12px`
  horizontally and past `max(72px, 30%)` of the row width to trigger; a shorter
  swipe springs back. Swipe-right on Master → Today, swipe-left on Today →
  Master. A near-vertical drag must *not* move the row (it scrolls). Allow
  ~600ms after release for the commit. Mouse HTML5 drag-reorder in Today is
  unaffected — verify it still works after any change to `.task__surface`.

- **Animations gate commits, so wait.** Completion (~0.4s) and the Master move
  (~0.25s) animate before `setState`. Under `page.emulateMedia({ reducedMotion:
  'reduce' })` they still *function* (the `animationend`/timeout still fire), so
  assert behaviour there too, just without waiting on visible motion.

- **Click-away closes the editor** (D54): a click on empty chrome (header, board
  gaps) closes `.edit-panel` and persists via the fields' blur-commits. A click
  inside any `.task` row (including another card) does not force-close it.

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

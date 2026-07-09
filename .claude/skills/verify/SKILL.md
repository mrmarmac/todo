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

Useful selectors:
- Add a task: `input[placeholder="New task…"]` + Enter
- Overflow menu: `.app__menu-btn`, items in `.app__menu-list` (Export / Import / Sync…)
- Sync dialog: `.sync-settings`, token input `input[aria-label="GitHub personal access token"]`
- Header sync dot: `.app__sync-indicator` (title = `Sync: <status>`)
- Confirms use `window.confirm` → handle via `page.on('dialog', ...)`

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

- Focus/visibility reconciles are throttled to one per 30s.
- `localStorage` keys: `todo-pwa/state/v1` (app state), `todo-pwa/sync/v1`
  (token + gistId + lastSyncedAt), `todo-pwa/sync/dirty/v1` (unsynced-changes flag).

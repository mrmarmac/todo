# CLAUDE.md

## What this is
Personal PWA todo app: three-column board (Master → Today → Done) with History. Single user, localStorage persistence, optional GitHub Gist sync.

## Commands
```
npm run dev       # dev server (Vite)
npm test          # run unit tests (Vitest, no watch)
npm run test:watch
npm run lint      # eslint (D47) — react-hooks rules are the point of it
npm run build     # tsc + vite build
```
CI runs lint + test + build on every PR and gates the Pages deploy (D48).
Web sessions install deps via a SessionStart hook (`.claude/hooks/session-start.sh`,
D49), so `npm test` works on the first call — no manual `npm install` needed.

## Architecture
**Strict two-layer split** (D10): business logic lives in `src/core/`, the React shell in `src/ui/` is a thin renderer only. Never put business logic in UI components.

```
src/
  core/
    types.ts          # All types: Task, Subtask, HistoryEntry, AppState
    state.ts          # All pure state-mutation functions (createTask, completeTask, etc.)
    safeStorage.ts    # Non-throwing localStorage wrapper + failure subscription (D41)
    storage.ts        # localStorage load/save + isAppState validator
    sort.ts           # Master sort order (due-date, no-date, recurring last)
    taskInput.ts      # Trailing date-token parser for title field (D36)
    exportImport.ts   # JSON export/import with versioned envelope (D16)
    gistSync.ts       # GitHub Gist sync logic (D31)
    dates.ts          # Date helpers
    urls.ts           # parseUrl — single-token URL detection (D26)
    progress.ts       # dayProgress() — header progress bar: Done-column tasks
                      #   + today's history entries vs still-open Today count
    __tests__/        # Unit tests for all of the above
  main.tsx            # Entry point; registers sw.js — PROD ONLY (D22)
  ui/
    App.tsx           # Root: loads state, wires effects, owns all handlers
    Column.tsx        # Shared collapsible column shell (D38)
    MasterColumn.tsx  # + the add-task form
    TodayColumn.tsx
    DoneColumn.tsx
    HistoryPanel.tsx
    SubtaskList.tsx   # Normal-view subtask rows: checkbox + title only (D51)
    TaskEditPanel.tsx # Inline card editor — tap the body to open (D51)
    Toast.tsx         # Bottom-centre one-tap undo bar (D51)
    TaskTitle.tsx     # URL pill rendering (D26)
    DueDate.tsx       # Due-date label + urgency colour (D28)
    ConfirmDialog.tsx # Shared confirm modal (import, History-entry delete)
    ShortcutHelp.tsx  # Keyboard shortcut overlay
    Icon.tsx          # Inline SVG icon set
    SyncSettings.tsx  # Sync… dialog
    useGistSync.ts    # Sync hook (push-on-change, pull-on-load/focus)
    useTheme.ts       # Light/dark/system toggle — sets documentElement.dataset.theme (D45)
    useLongPress.ts   # Click-on-mouse / hold-on-touch gesture — History rows (D50)
    useFocusTrap.ts   # Tab containment for the three modals (D46)
    cardKeys.ts       # Card keyboard nav + isEditTarget (tap-to-edit hit test, D51)
    styles.css        # All styles — "warm Bauhaus" visual system (D34)
```

## Data model (see `src/core/types.ts` for full types)
- **Task**: `id, title, dueDate, column ('master'|'today'|'done'), isRecurring, isActive, sourceTaskId, subtasks[]`
- **Subtask**: `id, title, isCompleted, isActive`
- **HistoryEntry**: `id, occurrenceType, taskId, parentTaskId, title, completedAt, day`
- **AppState**: `{ tasks, history, currentDay }` — `tasks` array order is the manual Today order.

## Key business rules (the non-obvious ones)
- `completeTask` **throws** if any subtask is open (D11). UI disables the completion checkbox, but the core still throws.
- Subtask guards differ per function — check before assuming:
  - `addSubtask` — no-op when parent is in **Done**; allowed in Master and Today (D12).
  - `completeSubtask` / `uncompleteSubtask` — no-op unless parent is in **Today**, so Master *and* Done are both blocked (D18). Undo path is Done→Today first, then un-tick.
  - Empty titles still **throw** in all of them, matching D11's title rule.
- `setActive` / `setActiveSubtask` are **no-ops** (not throws) for unknown id or item not in Today (D13).
- A recurring task **stays in Master** when added to Today; Today gets a day-copy (`sourceTaskId` set, `isRecurring: false`). Day-copies reset subtask completion on creation (D19).
  - Only **one live day-copy at a time** — `moveToToday` no-ops while `hasDayCopyInToday` is true, and the Master `→` button is disabled to match (D43).
  - `deleteTask` **cascades** to day-copies (D42) — an orphan with a dangling `sourceTaskId` would be silently destroyed by `removeFromToday` instead of returning to Master.
- History entries are editable in place: `updateHistoryEntry` changes the **title only**, `deleteHistoryEntry` **cascades** from a task entry to the subtask entries logged under it, and `historyDeletionScope` reports what a delete would take so the UI can confirm it (D50). Neither restores a task to a column.
- History is pruned to 30 days by `startNewDay`, measured from the newest logged `day` (never wall-clock — `currentDay` is manual, D3/D44).
- `save()` returns a boolean and never throws; all localStorage goes through `core/safeStorage.ts` (D41). Don't call `localStorage` directly.
- History `day` = manual `currentDay`, not wall-clock date (D3). Due-date labels use wall-clock day (D25).
- `startNewDay`: collapses Done → History (old day), discards unfinished recurring day-copies, returns remaining Today → Master, clears active, advances `currentDay` (D15).
- **Interaction model (D51):** tapping a Master/Today card body opens `TaskEditPanel` — the one place to retitle, re-date, edit/add/delete subtasks (blank a subtask input = delete), delete, move columns, and reorder Today. Completion is a **checkbox** (Today complete / Done uncomplete; Master has none). The Today "active" toggle is the **colour mark dot**, not the title. Delete / Clear / New Day apply immediately and raise the undo `Toast` (5s), which restores a full pre-action `AppState` snapshot (`runWithUndo` in `App.tsx`) — the only faithful undo for those inverse-less reducers. Add form height is always constant — no `:focus-within` expansion (D35).

## Constraints
- **Approved deps only** (D1, amended by D47): `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, plus dev-only `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`. Anything else needs explicit approval.
- No webfont loaded — type stack is Futura (macOS system) with geometric fallbacks (D34). Don't add `@import` for fonts.
- PWA is hand-rolled (`public/sw.js`, `public/manifest.webmanifest`) — no Vite PWA plugin (D17).
- localStorage keys: `todo-pwa/state/v1` (app state, `core/storage.ts`), `todo-pwa/sync/v1` (sync config **including the GitHub token** — D32, `core/gistSync.ts`), `todo-pwa/sync/dirty/v1` (dirty flag — D33, `ui/useGistSync.ts`), `todo-pwa/theme/v1` (theme preference — D45, `ui/useTheme.ts`).

## Visual system (D34)
"Warm Bauhaus" — edits to `styles.css` should follow this:
- Palette: paper `#F6F1E7`, ink `#1E1C19`, ochre `#E0A32E`, vermilion `#C0492E`, sage `#6E8B6A`, blue `#2C4A7C`.
- Column colours: Master = blue, Today = ochre, Done = sage. Vermilion = active item + overdue.
- Theming has **three** blocks in `styles.css` that must stay in sync when adding a colour var: `@media (prefers-color-scheme: dark)`, `:root[data-theme='dark']`, and `:root[data-theme='light']` (the manual toggle in `ui/useTheme.ts` must win over the system preference in both directions — D45).
- Tasks are rows on ruled paper, not cards. One 9px colour mark per row (circle = task, square = recurring).

## Verifying a change
- `npm test` covers the core. The UI has no unit tests — logic belongs in `src/core/` where it can be tested.
- To confirm a change in a real browser, use the `verify` skill (`.claude/skills/verify/SKILL.md`) — it has the build/launch/drive recipe. Don't re-derive it.

## Background docs
- `SPEC.md` — full feature spec (source of truth for behaviour)
- `DECISIONS.md` — architecture decisions D1–D51 (reference when a rule seems arbitrary)

Both are long. Read the relevant section, not the whole file.

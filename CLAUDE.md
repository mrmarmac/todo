# CLAUDE.md

## What this is
Personal PWA todo app: three-column board (Master → Today → Done) with History. Single user, localStorage persistence, optional GitHub Gist sync.

## Commands
```
npm run dev       # dev server (Vite)
npm test          # run unit tests (Vitest, no watch)
npm run test:watch
npm run build     # tsc + vite build
```

## Architecture
**Strict two-layer split** (D10): business logic lives in `src/core/`, the React shell in `src/ui/` is a thin renderer only. Never put business logic in UI components.

```
src/
  core/
    types.ts          # All types: Task, Subtask, HistoryEntry, AppState
    state.ts          # All pure state-mutation functions (createTask, completeTask, etc.)
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
    SubtaskList.tsx
    TaskEditForm.tsx
    TaskTitle.tsx     # URL pill rendering (D26)
    DueDate.tsx       # Due-date label + urgency colour (D28)
    ConfirmDialog.tsx # Shared confirm modal (import, Start New Day, delete)
    ShortcutHelp.tsx  # Keyboard shortcut overlay
    Icon.tsx          # Inline SVG icon set
    SyncSettings.tsx  # Sync… dialog
    useGistSync.ts    # Sync hook (push-on-change, pull-on-load/focus)
    cardKeys.ts       # Card keyboard nav: roving arrow focus, delete key
    styles.css        # All styles — "warm Bauhaus" visual system (D34)
```

## Data model (see `src/core/types.ts` for full types)
- **Task**: `id, title, dueDate, column ('master'|'today'|'done'), isRecurring, isActive, sourceTaskId, subtasks[]`
- **Subtask**: `id, title, isCompleted, isActive`
- **HistoryEntry**: `id, occurrenceType, taskId, parentTaskId, title, completedAt, day`
- **AppState**: `{ tasks, history, currentDay }` — `tasks` array order is the manual Today order.

## Key business rules (the non-obvious ones)
- `completeTask` **throws** if any subtask is open (D11). UI disables the button, but the core still throws.
- Subtask guards differ per function — check before assuming:
  - `addSubtask` — no-op when parent is in **Done**; allowed in Master and Today (D12).
  - `completeSubtask` / `uncompleteSubtask` — no-op unless parent is in **Today**, so Master *and* Done are both blocked (D18). Undo path is Done→Today first, then un-tick.
  - Empty titles still **throw** in all of them, matching D11's title rule.
- `setActive` / `setActiveSubtask` are **no-ops** (not throws) for unknown id or item not in Today (D13).
- A recurring task **stays in Master** when added to Today; Today gets a day-copy (`sourceTaskId` set, `isRecurring: false`). Day-copies reset subtask completion on creation (D19).
- History `day` = manual `currentDay`, not wall-clock date (D3). Due-date labels use wall-clock day (D25).
- `startNewDay`: collapses Done → History (old day), discards unfinished recurring day-copies, returns remaining Today → Master, clears active, advances `currentDay` (D15).
- Row actions (edit/delete/etc.) on hover-capable devices are absolutely positioned (no layout slot) to prevent reflow (D40). Add form height is always constant — no `:focus-within` expansion (D35).

## Constraints
- **Approved deps only** (D1): `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`. Anything else needs explicit approval.
- No webfont loaded — type stack is Futura (macOS system) with geometric fallbacks (D34). Don't add `@import` for fonts.
- PWA is hand-rolled (`public/sw.js`, `public/manifest.webmanifest`) — no Vite PWA plugin (D17).
- localStorage keys: `todo-pwa/state/v1` (app state, `core/storage.ts`), `todo-pwa/sync/v1` (sync config **including the GitHub token** — D32, `core/gistSync.ts`), `todo-pwa/sync/dirty/v1` (dirty flag — D33, `ui/useGistSync.ts`).

## Visual system (D34)
"Warm Bauhaus" — edits to `styles.css` should follow this:
- Palette: paper `#F6F1E7`, ink `#1E1C19`, ochre `#E0A32E`, vermilion `#C0492E`, sage `#6E8B6A`, blue `#2C4A7C`.
- Column colours: Master = blue, Today = ochre, Done = sage. Vermilion = active item + overdue.
- Theming has **three** blocks in `styles.css` that must stay in sync when adding a colour var: `@media (prefers-color-scheme: dark)`, `:root[data-theme='dark']`, and `:root[data-theme='light']` (the manual toggle must win over the system preference in both directions).
- Tasks are rows on ruled paper, not cards. One 9px colour mark per row (circle = task, square = recurring).

## Verifying a change
- `npm test` covers the core. The UI has no unit tests — logic belongs in `src/core/` where it can be tested.
- To confirm a change in a real browser, use the `verify` skill (`.claude/skills/verify/SKILL.md`) — it has the build/launch/drive recipe. Don't re-derive it.

## Background docs
- `SPEC.md` — full feature spec (source of truth for behaviour)
- `DECISIONS.md` — architecture decisions D1–D40 (reference when a rule seems arbitrary)

Both are long. Read the relevant section, not the whole file.

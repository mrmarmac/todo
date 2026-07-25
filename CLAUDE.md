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
    progress.ts       # Subtask progress helpers
    __tests__/        # Unit tests for all of the above
  ui/
    App.tsx           # Root: loads state, wires effects, owns all handlers
    Column.tsx        # Shared collapsible column shell (D38)
    MasterColumn.tsx
    TodayColumn.tsx
    DoneColumn.tsx
    HistoryPanel.tsx
    TaskEditForm.tsx
    SubtaskList.tsx
    TaskTitle.tsx     # URL pill rendering (D26)
    SyncSettings.tsx
    useGistSync.ts    # Sync hook (push-on-change, pull-on-load/focus)
    styles.css        # All styles — "warm Bauhaus" visual system (D34)
    cardKeys.ts       # Keyboard nav helpers
    ...
```

## Data model (see `src/core/types.ts` for full types)
- **Task**: `id, title, dueDate, column ('master'|'today'|'done'), isRecurring, isActive, sourceTaskId, subtasks[]`
- **Subtask**: `id, title, isCompleted, isActive`
- **HistoryEntry**: `id, occurrenceType, taskId, parentTaskId, title, completedAt, day`
- **AppState**: `{ tasks, history, currentDay }` — `tasks` array order is the manual Today order.

## Key business rules (the non-obvious ones)
- `completeTask` **throws** if any subtask is open (D11). UI disables the button, but the core still throws.
- `addSubtask` / `uncompleteSubtask` are **no-ops** on a Done parent (D12). Subtask tick/un-tick is also a no-op outside Today (D18).
- `setActive` / `setActiveSubtask` are **no-ops** (not throws) for unknown id or item not in Today (D13).
- A recurring task **stays in Master** when added to Today; Today gets a day-copy (`sourceTaskId` set, `isRecurring: false`). Day-copies reset subtask completion on creation (D19).
- History `day` = manual `currentDay`, not wall-clock date (D3). Due-date labels use wall-clock day (D25).
- `startNewDay`: collapses Done → History (old day), discards unfinished recurring day-copies, returns remaining Today → Master, clears active, advances `currentDay` (D15).
- Row actions (edit/delete/etc.) on hover-capable devices are absolutely positioned (no layout slot) to prevent reflow (D40). Add form height is always constant — no `:focus-within` expansion (D35).

## Constraints
- **Approved deps only** (D1): `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`. Anything else needs explicit approval.
- No webfont loaded — type stack is Futura (macOS system) with geometric fallbacks (D34). Don't add `@import` for fonts.
- PWA is hand-rolled (`public/sw.js`, `public/manifest.webmanifest`) — no Vite PWA plugin (D17).
- localStorage key: `todo-pwa/state/v1`. Sync dirty flag: `todo-pwa/sync/dirty/v1`.

## Visual system (D34)
"Warm Bauhaus" — edits to `styles.css` should follow this:
- Palette: paper `#F6F1E7`, ink `#1E1C19`, ochre `#E0A32E`, vermilion `#C0492E`, sage `#6E8B6A`, blue `#2C4A7C`.
- Column colours: Master = blue, Today = ochre, Done = sage. Vermilion = active item + overdue.
- Dark theme re-tunes the same six colours; both themes always present in CSS.
- Tasks are rows on ruled paper, not cards. One 9px colour mark per row (circle = task, square = recurring).

## Background docs
- `SPEC.md` — full feature spec (source of truth for behaviour)
- `DECISIONS.md` — architecture decisions D1–D40 (reference when a rule seems arbitrary)

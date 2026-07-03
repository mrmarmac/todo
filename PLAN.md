# PLAN.md — Personal To-Do PWA (TDD Implementation Plan)

## Context

Greenfield build in this repo. Source of truth is [SPEC.md](SPEC.md) (revised 2026-07-03, decisions in [DECISIONS.md](DECISIONS.md)): a single-user three-column to-do board (Master / Today / Done) with subtasks, one active item, recurring tasks via manual day-copies, manual Start New Day, a History log, and JSON export/import. Target: installable PWA on macOS.

This plan is for execution by Claude Code using strict red/green TDD, in vertical slices. **Do not start slice N+1 until the user confirms slice N works. Commit after each green slice. Suggest a fresh session after each slice.**

Approved dependencies only: `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`. Anything else requires user approval first (D1).

## Architecture

**Pure functional core, thin UI shell** (D10). All business rules live in pure TypeScript functions `(state, action-args) → newState` under `src/core/`. The React layer is a thin renderer that calls core functions and re-renders; it contains no business logic. This makes every spec rule unit-testable without a browser.

```
todo/
├── SPEC.md  PLAN.md  DECISIONS.md
├── index.html
├── package.json  tsconfig.json  vite.config.ts (Vitest config merged or separate)
├── public/
│   ├── manifest.webmanifest        # hand-rolled PWA manifest (no plugin)
│   ├── sw.js                       # minimal cache-first service worker
│   └── icons/ (192px, 512px)
└── src/
    ├── core/
    │   ├── types.ts                # Task, Subtask, HistoryEntry, AppState
    │   ├── state.ts                # all mutations as pure functions
    │   ├── sort.ts                 # Master sorting
    │   ├── storage.ts              # localStorage save/load + validation
    │   └── exportImport.ts         # JSON export / import
    ├── core/__tests__/             # Vitest unit tests (the TDD heart)
    ├── ui/                         # App.tsx, Column.tsx, TaskCard.tsx, …
    └── main.tsx
```

### Data model (SPEC §5)

```ts
interface Subtask { id: string; title: string; isCompleted: boolean; isActive: boolean }

interface Task {
  id: string;
  title: string;                    // required, non-empty
  dueDate: string | null;           // ISO date
  column: 'master' | 'today' | 'done';
  isRecurring: boolean;
  isActive: boolean;
  sourceTaskId: string | null;      // set on recurring day-copies
  subtasks: Subtask[];
}

interface HistoryEntry {
  id: string;
  occurrenceType: 'task' | 'subtask';
  taskId: string;
  parentTaskId: string | null;      // set when occurrenceType === 'subtask'
  title: string;
  completedAt: string;              // ISO timestamp
  day: string;                      // state.currentDay at completion
}

interface AppState {
  tasks: Task[];                    // array order = manual Today order
  history: HistoryEntry[];
  currentDay: string;               // ISO date, advanced by Start New Day
}
```

Invariants the core must always uphold (assert in tests across all slices):
- At most one `isActive` flag set across all tasks *and* subtasks combined.
- Active task ⇒ `column === 'today'`; active subtask ⇒ parent in Today.
- A task with any open subtask can never have `column === 'done'`.
- `sourceTaskId` non-null ⇒ the task is a day-copy.

## TDD protocol (applies to every slice)

1. Write the failing Vitest test(s) for one behaviour. Run: confirm **red** for the expected reason.
2. Write the minimum core code to pass. Run: confirm **green**.
3. Refactor if needed; keep green. No UI work until the slice's core tests pass.
4. Then wire the thin UI, verify manually via `npm run dev` against the slice's checklist.
5. `git commit -m "feat: <slice summary>"` (plain string). Never push without user OK.
6. Report to user; **wait for confirmation before next slice.**

---

## Slice 1 — Scaffold, Master column, persistence

*Proves the core works end-to-end: add a task, see it sorted in Master, survive a reload.*

Setup (no TDD needed): Vite + React + TS scaffold, Vitest configured, empty three-column layout renders. SPEC.md, PLAN.md, DECISIONS.md already sit in the repo. Commit the scaffold.

Core tests → implementation (`state.ts`, `sort.ts`, `storage.ts`):
- `createTask(title, dueDate?, isRecurring?)`: lands in Master; rejects empty/whitespace title; defaults (`dueDate: null`, flags false, `subtasks: []`, `sourceTaskId: null`).
- `updateTask(id, {title?, dueDate?, isRecurring?})` and `deleteTask(id)` (Master-only cases here; cross-column rules in Slice 2).
- `sortMaster(tasks)` (SPEC §7): non-recurring with dueDate (earliest first) → non-recurring without dueDate → recurring last regardless of dueDate; stable within groups.
- `storage.save/load`: round-trips AppState; `load` returns a fresh initial state (with today's `currentDay`) on missing/corrupt data instead of crashing.

UI: Master column with add form (title, optional due date, recurring checkbox), edit/delete controls, recurring tasks visually distinct (SPEC §10), auto-save on every change.

Manual check: add tasks of all three sort groups, verify order; edit, delete; reload page → state intact.

## Slice 2 — Plan Today: moves, day-copies, drag reorder

Core tests → implementation:
- `moveToToday(id)`: normal task changes `column` to `today` (leaves Master by definition of `column`); appended at bottom of Today order.
- `moveToToday(id)` on a recurring task: master stays in Master untouched; creates a **day-copy** in Today with a new `id`, `sourceTaskId` = master id, deep-copied subtasks, and `isRecurring: false` (D9). Edits to the copy don't touch the master, and vice versa (test both directions).
- Adding the same recurring master twice in one day: spec doesn't forbid it — allow (creates a second copy); flag to user during review if it feels wrong.
- `removeFromToday(id)` (D6): normal task → back to Master; day-copy → deleted.
- `reorderToday(id, targetIndex)`: pure reorder of Today sequence; Master/Done unaffected.
- `deleteTask` cross-column rules (SPEC §6.2): deleting a recurring master leaves its day-copies intact (their `sourceTaskId` now dangles — must not crash anything; test it).

UI: click-to-add control on Master tasks; Today column with HTML5 drag-and-drop reorder (`draggable`, `dragover`, `drop`); remove-from-Today control.

Manual check: move normal + recurring tasks, reorder by drag, remove both kinds, delete a recurring master and confirm its copy survives.

## Slice 3 — Complete, Done column, Clear → History

Core tests → implementation:
- `completeTask(id)`: only from Today; sets `column: 'done'`; clears its `isActive` (full active handling in Slice 5); blocked when any subtask open (testable now with a stub subtask on the task).
- `uncompleteTask(id)` (D5): Done → Today (end of Today order).
- `clearDone()` (SPEC §6.6): every Done task → one `task` HistoryEntry (`day: currentDay`, `completedAt: now`) **plus** one `subtask` entry per completed subtask (with `parentTaskId`); tasks removed from `tasks`; repeatable; no-op when Done empty; Today/Master untouched.
- History ordering: append chronologically.

UI: Done column (greyed, strikethrough), undo control on Done tasks, **Clear** button, History panel (D8) grouped by day, newest first.

Manual check: complete → appears struck-through in Done; undo; Clear twice in a day; History shows entries under current day.

## Slice 4 — Subtasks

Core tests → implementation:
- `addSubtask(taskId, title)` / `updateSubtask` / `deleteSubtask` — on any non-Done task.
- `completeSubtask(taskId, subtaskId)` / `uncompleteSubtask` (D5); completing clears the subtask's `isActive`.
- Parent gate: `completeTask` rejected while any subtask `isCompleted: false` (now for real); allowed when all complete or none exist.
- Completed subtask stays in place under parent (no independent movement) — structural, verified by the model itself.
- Day-copy inheritance (extends Slice 2): copies carry deep-cloned subtasks; completing a subtask on the copy leaves the master's subtask untouched.
- `clearDone()` with subtasks: completed subtasks of a cleared parent each produce their own HistoryEntry, only ever together with the parent (SPEC §6.6).

UI: expandable subtask list per task card; add/edit/delete/tick controls; struck-through in place; creation order only (D7).

Manual check: parent completion blocked until all subtasks ticked; day-copy subtask edits isolated from master; Clear logs parent + completed subtasks.

## Slice 5 — Active item

Core tests → implementation:
- `setActive(taskId)` / `setActiveSubtask(taskId, subtaskId)` / `clearActive()`.
- Single-active invariant: setting a new active clears the previous, whether task or subtask.
- Rejected unless task (or subtask's parent) is in Today.
- Auto-clear on: `completeTask` of the active task, `completeSubtask` of the active subtask, `removeFromToday`, `deleteTask`/`deleteSubtask` of the active item.
- Un-set by clicking the active item again (toggle).

UI: click-to-activate on Today tasks and their subtasks; one clearly highlighted item.

Manual check: activate task → activate subtask elsewhere → first highlight clears; complete active item → no highlight anywhere.

## Slice 6 — Start New Day

Core tests → implementation — `startNewDay(now)` executes in order (SPEC §6.7, D3, D4):
1. `clearDone()` — Done collapses to History under the **old** `currentDay`.
2. Unfinished recurring day-copies (`sourceTaskId !== null`) in Today: **discarded**, nothing logged.
3. Remaining unfinished Today tasks: `column: 'master'`; their subtasks all reset to `isCompleted: false`; nothing logged (no occurrence happened).
4. Any active flag cleared.
5. `currentDay` = today's date from `now`.
- Edge tests: empty Today; Today with only day-copies; completed subtasks on a returning parent reset; second immediate call changes nothing but `currentDay`.

UI: **Start New Day** button with a confirm step (destructive-ish: discards day-copies).

Manual check: stage a mixed board (done + unfinished normal + unfinished day-copy with ticked subtasks), press the button, verify all five effects and History grouping under the old day.

## Slice 7 — Export/Import + PWA + acceptance pass

Core tests → implementation:
- `exportState(state)`: JSON string containing full AppState + a `schemaVersion` field.
- `importState(json)`: validates shape (reject garbage with a clear error, never a crash); returns the restored AppState; replaces everything.
- Round-trip property: `importState(exportState(s))` deep-equals `s`.

UI: Export button downloads `todo-export-YYYY-MM-DD.json`; Import button with file picker **and an explicit confirm** ("replaces all current data") before applying.

PWA (hand-rolled, no plugin): `manifest.webmanifest` (name, icons, `display: standalone`), minimal `sw.js` precaching the built assets, registration in `main.tsx`. Verify installability in Chrome on macOS (Lighthouse PWA check or install prompt).

Final acceptance pass: walk SPEC §11 criteria 1–13 one by one against the running app; record results for the user. Full test suite green. `npm run build` succeeds; preview build serves and installs.

## Verification (overall)

- Every slice: `npx vitest run` green before UI work starts, and again before commit.
- Every slice ends with the listed manual browser checklist via `npm run dev`.
- Final: acceptance-criteria walkthrough + production build + PWA install check.
- Nothing is pushed anywhere without explicit user OK.

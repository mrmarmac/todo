# Personal To-Do App — Specification

*Revised 2026-07-03: incorporated review decisions D1–D9 (see DECISIONS.md). Original spec reviewed and amended before implementation.*

## 1. Summary

A single-user to-do app built around a three-column board: **Master**, **Today**, **Done**. The user maintains a master list, hand-picks tasks for the day, orders them by drag and drop, breaks them into subtasks, tracks one active item at a time, and clears finished tasks into a running History log.

**MVP target:** PWA on MacOS.

## 2. Non-Goals

No reminders, notifications, tags, notes, attachments, or search. Personal use only.

## 3. Architecture

- PWA: React + TypeScript + Vite; Vitest for tests; native HTML5 drag-and-drop (no DnD library).
- Persistence: full app state auto-saved to `localStorage` on every change, loaded on startup. Export/import (§9) is the manual backup path.
- Business logic lives in a pure TypeScript core, fully unit-tested; the UI is a thin rendering layer.

## 4. Core Concepts

**Master** — all tasks not currently in Today. Recurring tasks live here.

**Today** — tasks chosen for the current day. Manually populated from Master; reorderable.

**Done** — tasks completed today, shown greyed out with strikethrough. Stays visible until collapsed into History.

**History** — one running log of completed occurrences across all days.

**Active** — exactly one task *or subtask* active at a time. Active item must sit in Today (for a subtask, its parent must be in Today). It is visually highlighted. Setting new active item clears previous one.

**Day** — advanced manually via a **Start New Day** button (no automatic midnight rollover). The app stores a `currentDay` date, set from the wall clock when Start New Day is pressed (initialised on first launch). History entries record `currentDay`, not the completion wall-clock date — working past midnight does not split the log.

## 5. Data Model

### Task
- `id`
- `title` (required)
- `dueDate` — date or `null`
- `column` — `master` | `today` | `done`
- `isRecurring`
- `isActive`
- `sourceTaskId` — for a recurring day-copy, the id of its master task; otherwise `null`
- `subtasks` — array of Subtask

### Subtask
- `id`
- `title`
- `isCompleted`
- `isActive`

### History Entry
Represents one completed occurrence.
- `id`
- `occurrenceType` — `task` | `subtask`
- `taskId` — the completed task, or the completed subtask
- `parentTaskId` — set when `occurrenceType` is `subtask`; otherwise `null`
- `title`
- `completedAt`
- `day` — the `currentDay` value at completion

### App State
- `tasks` — array of Task (array order is the manual Today order)
- `history` — array of History Entry
- `currentDay` — ISO date string

## 6. Workflows

### 6.1 Add
Create a task in Master. Required: title. Optional: due date, recurring flag.

### 6.2 Edit / Delete
Tasks can be edited and deleted from any column.
- Deleting a normal task is permanent.
- Deleting a recurring **master** leaves its existing Today day-copies intact.

### 6.3 Plan Today
Select task/s from Master, click to add to Today.
- A normal task moves — it leaves Master.
- A recurring task stays in Master; the add creates a **day-copy** in Today (`sourceTaskId` → master). The day-copy inherits the master's subtasks with completion state reset — a fresh occurrence starts with all subtasks open. Edits to the day-copy do not touch the master, and vice versa.

Tasks in Today reorder by drag and drop.

**Remove from Today:** each Today task has a remove control. A normal task returns to Master; a recurring day-copy is discarded (its master still sits in Master).

### 6.4 Subtasks
Any task can hold subtasks. Subtasks keep creation order (no drag reorder in MVP).
- Completing all subtasks does **not** auto-complete the parent.
- A parent **cannot** be completed while any subtask is open.
- Ticking and un-ticking subtasks is a Today activity: subtasks of a task sitting in Master are not tickable (a recurring master is a template; its day-copies track the day's actual work).
- A completed subtask shows strikethrough in place under its parent and stays in Today. It is never independent: it travels to History only when its parent completes and is collapsed.
- A completed subtask can be un-ticked (undo) while its parent is still in Today. Once the parent sits in Done, undo the parent first (Done → Today), then un-tick (D12).

### 6.5 Complete a Task
Marking a task complete (allowed only when all its subtasks are complete):
- Moves it to Done, greyed with strikethrough.
- Clears active status if it was the active item.
- It remains in Done until collapsed.

**Undo:** a task in Done can be un-completed, returning it to the end of Today. Once cleared to History, completion is final.

### 6.6 Collapse to History
A **Clear** button moves all currently completed tasks — and their completed subtasks — from Done into History. Independent of Start New Day and repeatable any number of times per day. Clear only ever acts on a completed subtask together with its completed parent.

### 6.7 Start New Day
In order:
1. Done is collapsed into History (logged under the **old** `currentDay`), as if Clear were pressed.
2. Unfinished recurring **day-copies** in Today are discarded (their masters already sit in Master). Nothing is logged.
3. Remaining unfinished Today tasks return to Master. A returning parent carries its subtasks back with completion reset to incomplete. Nothing is logged to History, because the parent never completed — no occurrence happened.
4. Any active flag is cleared.
5. `currentDay` advances to today's date.

### 6.8 Set Active
Set one task or subtask as active. Clears any previous active item. The active item must be in Today (subtask: parent in Today), and a completed subtask cannot be set active. Highlighted in the UI. Clicking the active item again un-sets it.

## 7. Sorting

**Master** sorts, top to bottom:
1. Non-recurring tasks with a due date, earliest first.
2. Non-recurring tasks with no due date.
3. Recurring tasks (always last, regardless of due date).

Stable within each group unless the user reorders. Due date is used only for this sort.

**Today** order is manual (drag and drop).

## 8. Recurring Tasks

- Persist in Master permanently; adding to Today never removes them.
- **no automatic scheduling** — recurring means "persistent in Master, cloned into Today on manual add."

## 9. Export / Import

- Manual button exports **full app state** as JSON.
- A matching **Import / Restore** reloads full state from a JSON export, replacing all current data after an explicit confirmation.

## 10. UI

Three columns: Master, Today, Done. Visual states:
- Active item — clearly highlighted.
- Completed task/subtask — greyed with strikethrough.
- Recurring master — visually distinct from normal master tasks.

History: minimal read-only panel behind a toggle button, entries grouped by day, newest day first.

Interactions: click to move task from Master→Today, remove control on Today tasks, drag to reorder within Today, Clear button, Start New Day button, set/unset active, undo completion.

## 11. Acceptance Criteria

1. Runs as a PWA on MacOS.
2. User manually picks Today's tasks from Master.
3. Today reorders by drag and drop.
4. Subtasks supported; parent cannot complete with open subtasks; completed subtasks strike through in place.
5. Exactly one task or subtask is active at a time; active item is highlighted and sits in Today.
6. Completed tasks appear greyed with strikethrough in Done.
7. Clear moves completed tasks and their completed subtasks into History; repeatable, independent of Start New Day.
8. Start New Day collapses Done into History under the old day, returns unfinished Today tasks to Master, discards unfinished recurring day-copies, resets returning subtasks, logs nothing for unfinished tasks.
9. Moving a normal task to Today removes it from Master; a recurring task stays and spawns a day-copy.
10. Master sorts by due date, then no due date, then recurring last.
11. Tasks editable and deletable from any column, with the recurring-master deletion rule honoured.
12. Full app state exports to JSON and restores via import.
13. Completions can be undone (Done→Today; subtask un-tick while the parent is in Today) until cleared to History; Today tasks can be manually returned to Master.
14. Cross-device sync (§12) reflects local edits to the connected gist within a few seconds, applies remote edits made on another device, and prompts before either side is overwritten when both changed since the last sync.

## 12. Cross-Device Sync

Optional, off by default. A private ("secret") GitHub gist holds the full app state as a single JSON envelope (`{ schemaVersion, modifiedAt, state }`); sync is last-write-wins by `modifiedAt`, with a conflict prompt when both sides changed since the last sync.

- **Connect**: user supplies a GitHub personal access token scoped to `gist` only (Sync… dialog, reachable from the header status dot and the overflow menu). The app looks for an existing sync gist under that token; if found, it is pulled (silently applied if this device has no tasks/history yet, otherwise the user is asked which side to keep); if none is found, a new gist is created from the current state. The token is stored only in this device's `localStorage`.
- **Push on change**: local edits are pushed to the gist a few seconds after the last change (debounced), after re-checking the remote hasn't moved in the meantime.
- **Pull on load / focus**: the gist is checked once on app load and again whenever the tab regains focus (throttled), so a device picks up another device's edits without a manual action.
- **Conflict**: when both the local device and the gist changed since the last successful sync, the user is asked which copy to keep; the other is overwritten.
- **Disconnect**: stops syncing on this device only. Local data is untouched and the gist is not deleted — reconnecting with the same token resumes sync against it.
- **Status**: a small header indicator (shown once connected, or on error) reflects synced / syncing / offline / error; the Sync… dialog shows the same status plus a link to the gist and a manual "Sync now".

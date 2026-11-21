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
- `carriedDays` — optional; how many New Days have found this task unfinished in Today and carried it over (§6.7)
- `repeatDays` — optional; recurring masters only: weekdays it recurs on, 0 = Monday … 6 = Sunday (§8)
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

**Add straight to Today (D63).** Today has the same add field. A task added there starts in Today, at the end of the Today order, and is never recurring (a repeating task needs a Master original; make it in Master). Removing it from Today sends it to Master like any normal task.

The due date may be **typed as a trailing token in the title** — `today`, `tomorrow`, `mon`–`sun`, `+3d`, `+2w`, or an ISO date — which is stripped from the title and resolved to a date. Only the final whitespace-separated token counts, and only when a non-empty title remains; a trailing full stop ("Friday.") keeps a date word literal. The resolved date is shown beside the field before submitting, and a date picker remains available. A newly created task is briefly highlighted, since Master sorts (§7) and the task lands mid-list rather than at the bottom.

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

**Undo:** a task in Done can be un-completed, returning it to the end of Today. Once cleared to History, completion is final — a logged entry can be corrected or deleted (§6.6), but it never returns to a column.

### 6.6 Collapse to History
A **Clear** button moves all currently completed tasks — and their completed subtasks — from Done into History. Independent of Start New Day and repeatable any number of times per day. Clear only ever acts on a completed subtask together with its completed parent.

**Editing a logged entry.** A History entry can be corrected or removed, opened by clicking the row (mouse), pressing and holding it (touch), or pressing Enter with it focused (D50):
- **Edit** changes the entry's title only. Its day and completion timestamp are the record of when the occurrence happened and are not editable.
- **Delete** removes the entry after an explicit confirmation. Deleting a task entry also removes the completed-subtask entries logged under it, since a subtask occurrence is never independent of its parent (§6.4). Deleting a subtask entry leaves its parent alone.
- Neither action restores a task to a column — History is a log of what happened, and editing it is for fixing the log, not for undoing a completion.

### 6.7 Start New Day

**Plan my day (D61).** The New Day button opens a planning screen instead of rolling over at once. When the wall-clock date is later than `currentDay`, a band under the header says so and offers the same screen; the day is still never advanced automatically. The screen lists suggestions for the new day, each ticked by default, grouped in this order (a task appears once, in its first group):
- **Unfinished** — tasks still in Today (a recurring day-copy is offered as its master).
- **Overdue** — non-recurring Master tasks due before the new day.
- **Due today** — non-recurring Master tasks due on the new day.
- **Scheduled** — recurring masters whose `repeatDays` include the new day's weekday (§8).

**Stuck tasks and letting go (D65).** Each New Day that returns an unfinished task from Today adds one to its `carriedDays` (never reset; a task gone from the board takes its count with it). On the planning screen an Unfinished task that has been put off before says so ("Put off 3 times"), in vermilion from the third time. Every Unfinished one-off task has a **Let go** control: a let-go task is deleted when the day starts (the start is undoable as a whole). Unticking instead leaves it in Master. Recurring masters cannot be let go here — unticking skips the repeat.

"Start day" runs the steps below, then moves the ticked tasks into Today in the listed order. "Not yet" closes the screen and changes nothing. The whole start is undoable from the undo toast. With nothing to suggest, the screen says so and starting gives an empty Today.

In order:
1. Done is collapsed into History (logged under the **old** `currentDay`), as if Clear were pressed.
2. Unfinished recurring **day-copies** in Today are discarded (their masters already sit in Master). Nothing is logged.
3. Remaining unfinished Today tasks return to Master. A returning parent carries its subtasks back with completion reset to incomplete. Nothing is logged to History, because the parent never completed — no occurrence happened.
4. Any active flag is cleared.
5. `currentDay` advances to today's date.

### 6.8 Set Active
Set one task or subtask as active. Clears any previous active item. The active item must be in Today (subtask: parent in Today), and a completed subtask cannot be set active. Highlighted in the UI. Clicking the active item again un-sets it.

### 6.9 Focus

**Focus (D66)** shows the Now item's task alone, full screen: its title at large scale, its steps (tickable), a **Done** button (disabled while steps are open, with a note saying how many remain) and **Not now** (clears the Now flag). Below it, "Up next" lists the other Today tasks; picking one makes it Now. With no Now item — none set, or the Now task was just finished — Focus asks "What now?" and offers Today's tasks; it never advances to the next task by itself. With nothing in Today it says the day is clear. Opened from the header (target icon) or the `f` key; Escape or × closes it.

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
- **Schedules suggest, never add (D60).** A recurring master may list the weekdays it recurs on (editor: "Suggest on" day toggles; row label e.g. "repeat · weekdays"). A schedule only makes the task a suggestion on the Plan my day screen (§6.7); nothing enters Today unless the user starts the day with it ticked. A day-copy does not carry its master's schedule.

## 9. Export / Import

- Manual button exports **full app state** as JSON.
- A matching **Import / Restore** reloads full state from a JSON export, replacing all current data after an explicit confirmation.

## 10. UI

Three columns: Master, Today, Done. Visual states:
- Active item — clearly highlighted.
- Completed task/subtask — greyed with strikethrough.
- Recurring master — visually distinct from normal master tasks.

History: minimal panel behind a toggle button, entries grouped by day, newest day first. Entries read as plain text and open an inline title editor (with Delete) on click / long press (§6.6).

**Editing in place (D64).** Tapping a task opens it where it sits. The title is the row's own text, editable directly, with no input box. Below it, details are tappable chips: **date** (opens the native date picker; a × clears it), **Repeat** (Master; shows the schedule, and when on reveals the day toggles of §8) and **Now** (Today; sets or clears the active item, §6.8). Steps (subtasks) are plain lines of text. Changes save as they are made; there is no Done button — Escape, Enter in the title, or a tap outside closes it.

Interactions: click to move task from Master→Today, remove control on Today tasks, drag to reorder within Today, Clear button, Start New Day button, set/unset active, undo completion.

**Column collapse.** Each of the three columns can be collapsed to its header. The layout decides what the freed space does: on desktop the board is a three-track grid, so a collapsed column keeps its horizontal slot and its neighbours do not move; on a narrow screen the board is a single stacked track, so collapsing frees vertical space and the columns below flow up to fill it.

**One responsive board.** Desktop and mobile share the same board and the same markup; there is no separate mobile shell. Touch devices get permanently visible row actions at a full tap target, and reorder Today with the Move up/down controls rather than dragging. When the board is stacked (900px and narrower), columns show in the order **Today, Done, Master**, so the day's work is on top and the growing planning list sits last (D62); desktop keeps Master, Today, Done left to right.

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
15. History entries can be retitled or deleted in place (click / long press), with a task entry's deletion taking its logged subtasks with it.

## 12. Cross-Device Sync

Optional, off by default. A private ("secret") GitHub gist holds the full app state as a single JSON envelope (`{ schemaVersion, modifiedAt, state }`); sync is last-write-wins by `modifiedAt`, with a conflict prompt when both sides changed since the last sync.

- **Connect**: user supplies a GitHub personal access token scoped to `gist` only (Sync… dialog, reachable from the header status dot and the overflow menu). The app looks for an existing sync gist under that token; if found, it is pulled (silently applied if this device has no tasks/history yet, otherwise the user is asked which side to keep); if none is found, a new gist is created from the current state. The token is stored only in this device's `localStorage`.
- **Push on change**: local edits are pushed to the gist a few seconds after the last change (debounced), after re-checking the remote hasn't moved in the meantime.
- **Pull on load / focus**: the gist is checked once on app load and again whenever the tab regains focus (throttled), so a device picks up another device's edits without a manual action.
- **Conflict**: when both the local device and the gist changed since the last successful sync, the user is asked which copy to keep; the other is overwritten.
- **Disconnect**: stops syncing on this device only. Local data is untouched and the gist is not deleted — reconnecting with the same token resumes sync against it.
- **Status**: a small header indicator (shown once connected, or on error) reflects synced / syncing / offline / error; the Sync… dialog shows the same status plus a link to the gist and a manual "Sync now".

## 13. Visual Design

The visual system lives in [DESIGN.md](DESIGN.md) (D58).

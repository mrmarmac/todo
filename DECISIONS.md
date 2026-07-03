# DECISIONS.md

- **D1** Stack: React + TypeScript + Vite, Vitest, native HTML5 drag-and-drop — most standard stack, no DnD dependency needed for a simple vertical list. Approved deps only: react, react-dom, typescript, vite, @vitejs/plugin-react, vitest; anything else needs explicit approval. — 2026-07-03 (spec review)
- **D2** Persistence via localStorage auto-save on every change — spec omitted storage; simplest correct option for a single-user PWA; export/import is the backup path. — 2026-07-03 (spec review)
- **D3** History `day` = stored `currentDay` set by Start New Day, not wall-clock date at completion — working past midnight must not split a manual day's log. — 2026-07-03 (spec review)
- **D4** Start New Day auto-collapses Done into History under the old day before resetting Today — avoids stale strikethrough tasks lingering into the new day. — 2026-07-03 (user choice)
- **D5** Undo completion allowed (Done→Today; subtask un-tick) until cleared to History — protects against misclicks. — 2026-07-03 (user choice)
- **D6** Manual Today→Master removal allowed; day-copies are discarded on removal — fixes planning misclicks without waiting for Start New Day. — 2026-07-03 (user choice)
- **D7** Subtasks keep creation order, no drag reorder in MVP — not in spec, keeps scope down. — 2026-07-03 (spec review)
- **D8** History UI is a minimal read-only toggle panel grouped by day, newest first — spec defined History data but no display. — 2026-07-03 (spec review)
- **D9** Day-copies get `isRecurring: false`; provenance lives in `sourceTaskId` — the copy is an ordinary Today task, keeps sorting and deletion rules simple. — 2026-07-03 (spec review)
- **D10** Architecture: pure TypeScript core (state.ts et al.) with thin React shell — makes every spec rule unit-testable without a browser; suits red/green TDD. — 2026-07-03 (spec review)
- **D11** `completeTask` throws on open subtasks (rather than silently no-op) — the parent gate is a business-rule violation like an empty title, so a hard error is clearer; the UI also disables the Complete button as a first line of defence. — 2026-07-03 (slice 3)
- **D12** Subtask ops guard the "done never holds an open subtask" invariant by no-op: `addSubtask` and `uncompleteSubtask` do nothing on a Done parent (empty title still throws, matching D11's title rule) — keeps the model always valid; the undo flow is Done→Today first, then un-tick. — 2026-07-03 (slice 4)

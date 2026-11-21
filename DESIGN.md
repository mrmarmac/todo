# DESIGN.md — Visual System

The single source of truth for how the app looks. `SPEC.md` describes behaviour; this file describes appearance. Origin: D34 ("Warm Bauhaus", Direction A "Grid & Rule"). Tokens live in `src/ui/styles.css` `:root`; change them there and record the change here.

## Direction

"Warm Bauhaus": geometric modernism on warm paper. Flat shapes, one accent at a time, no ornament. Heavy ink rules build the grid; type sits on that grid; colour shrinks to one small mark per row.

## Colour

Six fixed brand colours:

| Token | Light | Dark (re-tuned) | Role |
|---|---|---|---|
| `--paper` / `--bg` | `#F6F1E7` | `#16140F` | Ground |
| `--ink` / `--fg` | `#1E1C19` | `#EDE6D6` | Text, heavy rules |
| `--blue` → `--c-master` | `#2C4A7C` | `#6E93C9` | Master column |
| `--ochre` → `--c-today` | `#E0A32E` | `#E8B24C` | Today column (as text: `--c-today-text` `#96690C` in light, for contrast) |
| `--sage` → `--c-done` | `#6E8B6A` | `#8FAE8A` | Done column |
| `--vermilion` → `--c-active` | `#C0492E` | `#E0674A` | Active item and overdue dates only |

Rules:
- Each column owns exactly one hue, so only one accent is in play at a time.
- Vermilion is reserved for the active item and overdue dates.
- Neutrals (`--muted`, `--faint`, `--rule`, washes) are ink or paper at reduced opacity, never new hues.
- Components style through the semantic tokens (`--bg`, `--fg`, `--c-*`), never raw hex, so the dark theme is a token swap.

**Theme blocks.** `styles.css` has three blocks that must stay in sync when a colour token is added: `@media (prefers-color-scheme: dark)`, `:root[data-theme='dark']`, and `:root[data-theme='light']`. The manual toggle (`ui/useTheme.ts`) must win over the system preference in both directions (D45).

## Type

| Token | Stack | Use |
|---|---|---|
| `--font-display` | Futura, Futura PT, Avenir Next, Century Gothic, geometric fallbacks | Headings, column names, labels, buttons |
| `--font-body` | Avenir Next, Avenir, sans fallbacks | Task titles, body text |
| `--font-data` | ui-monospace, SF Mono, Menlo | Dates, counts, the day label, so figures align |

- No webfont is loaded, so nothing can silently fall back mid-session. Do not add a font `@import`.
- Base size 16px, line height 1.5. Sizes are rem steps between about 0.62rem (micro labels) and 1.05rem (titles). Hierarchy comes from case, weight and letter-spacing more than size.
- Labels are uppercase display type, tracked 0.10–0.22em (most often 0.12em).

## Space and layout

- **Rows, not cards.** Tasks are rows on ruled paper: hairline rules (`--rule`) between rows, a 3px `--rule-strong` rule under each column header and under the app header.
- **Colour mark.** One 9px mark per row: a circle for a task, a square for a recurring master.
- **Board.** Desktop is a three-track grid (`repeat(3, 1fr)`). At 900px and below it becomes a single stacked track. A collapsed column keeps its slot on desktop and frees vertical space when stacked (D38).
- **Stacked order.** When stacked, columns read Today, Done, Master (CSS `order`, D62). Desktop keeps Master, Today, Done left to right.
- **Plan my day.** A modal on the shared modal surface. Its one expressive move is the weekday name in display type at scale (`clamp(2.2rem, 9vw, 3rem)`); everything else stays small and ruled. Picks tick in the Today hue, not sage, because ticking here means "into Today", not "done" (D61).
- **New-day band.** A quiet band under the header with a 4px Today-coloured inset edge (D61).
- **Editor chips (D64).** Details in the inline editor are chips: 3px corners, 1px `--rule` border, body type at 0.84rem, `--muted` until set; set = `--fg` text with a `--rule-strong` border. The Now chip, when on, fills with `--c-active` (vermilion is reserved for the active item). 2.1rem tall, 2.75rem (44px) on touch. The editor title is borderless, in the row's own type; steps are plain lines with a small ring.
- **Schedule toggles.** Seven 2rem square day toggles, filled with the Master hue when on (D60).
- **Padding.** Compact rows (about 0.2–0.45rem vertical) inside generous column gutters (`clamp(0.85rem, 2vw, 1.4rem)`); dialogs use 1–1.25rem. The header respects `env(safe-area-inset-*)`.
- **Must work at 375px wide** (iPhone 13 mini) and on macOS.

## Corners and depth

- Square by default (`border-radius: 0`); small controls may use 3px.
- Circles (`50%`) only for the geometric marks and the sync dot.
- Depth is flat: no drop shadows on rows. Row states use inset edge bars instead (e.g. a 4px vermilion bar on the active row, a 3px column-colour bar on flashed rows).
- Raised surfaces (menus, dialogs) use `--raised` with a rule border. The undo toast is the one floating element and carries a soft drop shadow so it reads above the board.

## Motion

- Tokens: `--dur-quick` 0.15s, `--dur-move` 0.3s, `--ease-brisk` (crisp), `--ease-settle` (restrained overshoot, not a spring). Theme-independent.
- Crisp and physical, not bouncy. Rest → hover (grow/brighten) → press (compress).
- All hover rules sit inside `@media (hover: hover)` so touch never sticks them on.
- `prefers-reduced-motion` clamps every animation to about 0ms. Logic must never depend on an animation's visible duration (D52).

## Interaction rules that shape the look

- **No layout shift.** Controls never appear by expanding a container that pushes content around. The add form's height is constant (D35); row actions are lifted out of layout on hover devices (D40). A click can never land on something that moved.
- Touch gets visible controls at full tap size; desktop reveals them on hover or focus.

## Empty, loading and error states

- Each column has a one-line empty hint in `--muted` (e.g. "Add tasks from Master with →").
- Storage failure shows a full-width alert band (`.app__storage-warning`, D41).
- Sync status shows as a header dot: synced / syncing / offline / error.

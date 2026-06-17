# TTabler

A fast, dependency-free **school timetable editor** that runs entirely in the
browser. Build a week of classes, drag lessons onto the grid, auto-generate a
clash-free schedule, and share it with a link — no server, no accounts, no
build step.

> *"This is the result of a scarred DB admin making a timetable."*

## Quick start

It's plain HTML/CSS/JS — **no build, no npm**. Either:

- **Just open it:** double-click `index.html` (or host the folder on any static
  server — GitHub Pages works as-is).
- **Or serve locally:** `python -m http.server 8000` then visit
  `http://localhost:8000/`.

From the landing page: **New timetable**, **Load sample**, **Import file**
(`.json`), or **Import aSc XML** (an aSc Timetables export). Each timetable is
saved independently in your browser.

## Features

- **Drag-and-drop grid** with live clash detection — clashing cards pulse red and
  their tooltip says *why* (e.g. "Mr Adams also teaches 8A here").
- **Auto-generator** — greedy placement with randomized restarts; spreads a
  subject across the week, respects everything below.
- **Views** — By Class / Teacher / Subject / Room, plus a dense **all-classes
  overview**. Click any entity (or an overview row) to drill into its timetable.
- **Groups & divisions** — split a class (e.g. *Gender → Boys / Girls*); two
  disjoint groups of the same division may share a slot.
- **Time-off** — paint slots where a class/teacher/room is unavailable; the
  generator avoids them.
- **Load ceilings** — per-week and per-day caps per entity; the load badge
  doubles as a fullness meter and turns red when over.
- **Card locking** — pin a placed card so Generate and Clear leave it put.
- **Variable periods per day** — short Fridays etc. via per-day period counts.
- **Non-binding rooms** — two lessons may share a room by default (toggle
  `ENFORCE_ROOM_CLASHES` in `constraints.js` to make rooms exclusive again).
- **Share / export** — copy a self-contained link, or export/import JSON.

## Data model

One timetable is a plain object (see `blankState()` / `demoState()` in
`js/state.js`):

```
{
  days: ["Mon", …], periods: ["1", …], periodsPerDay: [8,8,8,8,5] | null,
  subjects:  [{ id, name, color, short? }],
  teachers:  [{ id, name, short?, off?: ["d|p"], maxWeek?, maxDay? }],
  classes:   [{ id, name, short?, off?, maxWeek?, maxDay?,
                divisions?: [{ id, name, groups: [{ id, name }] }] }],
  rooms:     [{ id, name, short?, off? }],
  lessons:   [{ id, classId, subjectId, teacherId, roomId, count, groupId? }],
  assignments: [{ id, lessonId, day|null, period|null, locked? }],
  ui: { mode, entity, overview? },
  id, name, createdAt, updatedAt
}
```

- A **lesson** is a teaching requirement (`count` periods/week). Each unit
  becomes an **assignment** (a draggable card), placed at `{day, period}` or
  `null` (in the unplaced tray).
- Slots are `"day|period"` index strings throughout.

## Project layout

Plain `<script>` tags in dependency order, sharing one global scope (no modules,
no bundler). Each file owns one concern:

| File | Concern |
|---|---|
| `js/util.js` | tiny helpers (`$`, `uid`, `toast`, `escapeHtml`, `safeColor`, `PALETTE`) |
| `js/state.js` | data model + lookups, groups, period helpers, migrations |
| `js/storage.js` | the timetable library in `localStorage`, share/file I/O, debounced autosave |
| `js/constraints.js` | clash rules + `computeConflicts()` (the hot path) |
| `js/generator.js` | the auto-scheduler |
| `js/editors.js` | the data-editor drawer (entities, groups, caps, time structure) |
| `js/grid.js` | the grid, overview, tray, stats; central `render()` |
| `js/dnd.js` | drag and drop |
| `js/share.js` | build/copy the share link |
| `js/asc-import.js` | parse an aSc Timetables XML export |
| `js/library.js` | the landing page (`index.html`) |
| `js/app.js` | editor entry point — wires the toolbar, boots `render()` |

`index.html` is the library; `editor.html` is the editor.

## Tests

Open **`tests.html`** in a browser — a zero-dependency suite (~25 assertions)
over the constraint engine and generator. Green means pass; the tab title shows
the result. No runner, no install.

## Notes

- **Storage is per-browser.** Timetables live in this browser's `localStorage`;
  they don't sync across devices. Use Share/Export to move one.
- **Asset versioning.** Script/style URLs carry a `?v=N` query bumped on each
  release so browsers pick up new code without a hard refresh.
- **Made in Claude Code** — vibe-coded, iteratively.

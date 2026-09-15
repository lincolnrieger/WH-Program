# Woodhouse Program Builder

An itinerary builder for Woodhouse Adventure Park and Roonka school camps.

Drag activities onto a time grid, one column per group. Timings are free-form —
drag a block anywhere, drag its edges to change the length — and the app checks
the things a spreadsheet can't: venue double-bookings across schools, staff
rostered in two places, activities that shouldn't run at the same time, and
sessions with nobody qualified assigned.

- **[SETUP.md](SETUP.md)** — deploy to Cloudflare from GitHub, step by step.
- **[DATA.md](DATA.md)** — where the activity, venue and staff data comes from,
  and how to change it.

---

## What it does

**Scheduling**
- Drag an activity from the palette onto any group column at any time.
- Drag a block to move it; drag its top or bottom edge to change the length.
- Snap to 5 / 10 / 15 / 30 minutes; hold <kbd>Alt</kbd> while dragging for
  5-minute precision without changing the setting.
- Type times directly in the inspector — `9`, `930`, `9:30`, `1.30pm` all work.
- Arrow keys nudge the selection: up/down to move, <kbd>Alt</kbd>+up/down to
  resize, left/right to move between group columns.

**Faster than a spreadsheet**
- **Day templates** — Arrival day, Full day, Departure day, Day visit. Lays down
  the meals and logistics at the standard times so only activities are left.
- **Rotation builder** — pick groups, activities and time slots and it generates
  the rotation so every group does every activity once and no two groups collide.
  Shows the matrix before it commits anything.
- **Copy day** — duplicate one day of a booking onto another.
- Undo/redo across everything (<kbd>Ctrl</kbd>+<kbd>Z</kbd>).

**Checks that run as you build**

| Check | Severity |
| --- | --- |
| A group booked into two things at once | Clash |
| A venue double-booked across schools | Clash |
| Single-equipment activity running twice at once | Clash |
| A staff member rostered in two places | Clash |
| "Don't run at the same time as…" pairs | Check |
| Staff assigned without a sign-off for that activity | Check |
| Not enough staff for the activity | Check |
| Group larger than the activity cap | Check |
| Too little time to pack down and set up between sessions | Check |
| A group with a long unscheduled gap | Note |

**Five sections**
- **Plan** — one school, one day, a column per group. The main editing surface.
- **Whole site** — every school on site that day, side by side. The same picture
  as the current *Holistic* sheet, but clashes between schools are flagged, and
  you can drag a session straight from one school to another.
- **Staff** — who's trained on what, editable. See below.
- **Activities** — the catalogue: durations, set-up/pack-down, venue, capacity,
  staff needed, clash rules.
- **Venues** — the spaces activities run in.

The week bar under the toolbar moves between weeks and days. A program holds as
many weeks as you like; each day shows how many schools are on site.

**Getting work out**
- **Print** (<kbd>Ctrl</kbd>+<kbd>P</kbd>) — choose the scope (one school's whole
  stay, everyone on site for a day, or everyone from today on), then one page
  per school laid out like the current handout, with the activity colours
  carried across and a colour key at the end. Print in **landscape** with
  **background graphics** on.
- **Export CSV** — one row per session, pastes straight back into Excel.
- **Save to file / Open** — JSON, for sharing a plan or keeping a backup.

## Editing the catalogue

Activities, venues and staff training all started life in the source workbooks,
but everything is editable in the app — you don't need to touch the code.

- **Activities** → add, edit or remove. Colour, how long it runs, set-up and
  pack-down, venue, capacity, staff needed, how it's delivered, and which
  activities it must not run alongside. Changes feed straight into the palette
  and the scheduling checks.
- **Venues** → add or edit spaces. Venue clash detection picks them up at once.
- **Staff** → *By person* lists every activity with a level you can set in one
  click; *Full matrix* is the dense grid from the training workbook, with the
  same colours, where clicking a cell steps through the levels.

Edits are stored as an **overlay** on the shipped data, not a copy of it. So
re-running the workbook import later refreshes everything you haven't
overridden, and a cell you've changed by hand is marked with a dot so the two
are easy to tell apart. Removing a seeded record hides it rather than destroying
it — **Restore removed** on the Activities page brings them back.

## Where the data lives

Everything is stored in your browser (`localStorage`) and saves as you type.
There is no server and no login, which means:

- The plan is **per browser, per device**. It does not sync between computers.
- Clearing site data clears the plan.
- To share or move a plan, use **File → Save to file** and send the `.json`.

Adding real multi-user sync is the natural next step —
[SETUP.md](SETUP.md#next-step-shared-plans-across-staff) sketches how.

## Running it locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build locally
npm run deploy       # build and push to Cloudflare
```

## How it's put together

```
src/
  types.ts                 domain model — read this first
  data/
    activities.ts          activity catalogue: colours, durations, clash rules
    venues.ts              venues and accommodation
    staff.generated.ts     staff competency, generated from the training workbook
    staff.ts               expands the generated data
    resolve.ts             merges the seed catalogues with in-app edits
    templates.ts           day templates
    seed.ts                the sample week
  lib/
    time.ts                minutes-from-midnight helpers, loose time parsing
    colour.ts              turns one activity colour into a readable block palette
    conflicts.ts           every scheduling rule
    rotation.ts            the rotation generator
    layout.ts              works out where each block sits on the grid
    exportImport.ts        JSON and CSV
  store/
    useStore.ts            document state, undo/redo, persistence
    dragStore.ts           drag state + the grid registry
    persist.ts             localStorage with schema migration
  hooks/
    useDragController.ts   the pointer handlers behind every drag
  components/
    pages/                 Staff, Activities and Venues management
    schedule/ week/        the grid, in both views
    panels/ print/ ui/     inspector, print sheet, shared primitives
scripts/
  generate-staff.py        regenerates staff data from the .xlsx
```

A few decisions worth knowing about:

- **Times are minutes from midnight**, dates are `YYYY-MM-DD` local calendar
  days. No timezones anywhere — a camp day is a calendar day.
- **Drag is hand-rolled** rather than a library. A time grid needs pixel-accurate
  snapping, edge resizing and drop targets computed from geometry; one custom
  pointer controller (`useDragController.ts`) does all three consistently.
- **Activity colours are kept but softened.** The spreadsheets use ~40 saturated
  fills, which is unreadable at screen density. Blocks render as a soft tint of
  the original colour with a saturated left rail, so the colour language staff
  already know survives while the text stays legible in both themes.
- **Undo snapshots the whole document.** A week of blocks is a few hundred
  objects — small enough that snapshotting is simpler and safer than diffing.

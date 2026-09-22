# Woodhouse Program Builder

An itinerary builder for Woodhouse Adventure Park and Roonka school camps.

Drag activities onto a time grid, one column per group. Timings are free-form —
drag a block anywhere, drag its edges to change the length — and what comes out
is the itinerary, in the same colours and the same shape as the spreadsheets it
replaces.

It builds itineraries and nothing else. Who runs a session is rostered
elsewhere, so the app doesn't assign staff and doesn't police the plan: the
programmer decides, the app draws. The **Staff** page is a reference table of
who is trained on what, and that is all it is.

One shared plan, saved as you type to a database behind the site. Open the same
URL on any computer and you're looking at the same thing — no files to pass
around, nothing to remember to save.

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
- **Add activities** — two questions. *Pick the activities*, then *choose how
  they go in*:
  - **I'll place them** puts them at the top of the palette under **Picked** and
    leaves them alone; you drag each one where you want it. Most of the time
    this is the one you want.
  - **Fill the timetable** lays them out as a rotation instead: every group does
    every activity once, no two groups collide, and across days it keeps
    counting rather than restarting, so Tuesday picks up where Monday left off.
- **Add a custom activity** — the box at the top of the palette takes a name and
  makes an activity there and then, ready to drag. It's a real catalogue entry,
  so its colour and length are editable on the Activities page afterwards.
- **View** sets how the grid is drawn, as choices rather than dials: a **size**
  (Compact to Huge), which **hours** to show (activity hours, the whole camp
  day, everything, or a pair of times you set), what dragging **snaps** to, and
  whether blocks carry their times and venue. It remembers what you picked.
- Undo/redo across everything (<kbd>Ctrl</kbd>+<kbd>Z</kbd>).

**Five sections**
- **Plan** — one school at a time. **Day** is a column per group for the day
  you're on, the close-up you build in; **Whole stay** lays every day of the
  visit out side by side against the same time axis, which is the view you want
  when you're checking a group doesn't do the tube slide twice, or dragging
  Wednesday's spare session back to Tuesday. Clicking a day's heading in that
  view opens it on its own. The **Schools** list beside it is the week you're
  looking at, not the whole term; search it to reach any school in any week.
- **Whole site** — the holistic picture, as a **day** or a whole **week**, for
  every school or just one. Day mode is the same grid as the planning view, one
  block of columns per school, with sessions draggable straight from one school
  to another. Week mode drops the time axis for seven days at once — the view
  you want when you're working out where a new booking fits.
- **Staff** — who's trained on what. A reference table, not a roster.
- **Activities** — the catalogue: name, colour, how long it runs, venue, and how
  it's offered.
- **Venues** — the spaces activities run in.

The week bar under the toolbar moves between weeks and days, labelled the way
camps are actually booked: **Term 3 Week 9**, with the calendar dates under it.
The week picker lists whole weeks the same way, with a dot per school on site,
so jumping to the week you mean is one click. South Australian term dates are
in `src/lib/term.ts` — see [DATA.md](DATA.md#school-terms).

## Getting work out

**Print / PDF** (<kbd>Ctrl</kbd>+<kbd>P</kbd>) asks one question — what do you
want — and then saves it as a PDF or sends it to a printer.

| Choice | What you get |
| --- | --- |
| One school, whole stay | The handout you give the school: every day, a column per group |
| One school, one day | Just that day of the visit |
| Everyone on site, one day | Every school here that day, side by side |
| Everyone on site, one week | The whole week, a band per day |

**On paper**, both sheets are reproductions of the ones the program has always
sent out, because staff, teachers and schools all know them by sight. What
changed is only where they come from.

The **school program** is A4 portrait: the Woodhouse logo, the school's name in
green, the dates and the note that TL means teacher led, then one bordered table
per day with the weekday in the corner and a column per group. The **holistic
sheet** is A3 landscape, a band per day, every school on site side by side, each
keeping its own time column — a day visit arriving at 9.45 and a camp starting
at 7.30 don't share a clock, but the bands still read straight across. Cells
past the end of a school's day are blacked out, which is how that sheet has
always shown a school has left.

Activity colours are the fills from the colour key, at full strength.
The paper size is set for you; turn on **Background graphics** in the print
dialog so the colours come through.

**As a spreadsheet**, the same two sheets come out of the Program menu as real
`.xlsx` files laid out like the workbooks they replace, with the exact fills
from the colour key and the key itself on its own tab.

**Import** (Program → *Import from spreadsheets*) reads the workbooks the
program was run from before this app and turns them into bookings and sessions.
Drop in a week's `.xlsx` files or the zipped week folder itself; both the
holistic week sheet and the schools' own itineraries are understood, and a stay
described by both is reconciled rather than imported twice. Nothing is written
until you've seen the preview — every stay, its session count, and any name the
catalogue didn't recognise — and the whole import lands as one step, so
<kbd>Ctrl</kbd>+<kbd>Z</kbd> takes it back out.

The sheets are hand-maintained, so the reader is forgiving: it repairs am/pm
slips in the time column (an `11.30pm` between recess and lunch is half past
eleven in the morning), follows sessions merged across groups or down the rows,
reads a group column the heading row forgot to name, and matches "Tube Slide OR"
and "Challenge Hill (Dry)" to the activities they extend. Anything still
unrecognised is added to the catalogue keeping the colour it had in the
spreadsheet, rather than being dropped.

**Program menu**, in three parts — what you bring in, what you take out, and
the plan as a whole.
- *Save this week as a spreadsheet* / *Save <school> as a spreadsheet* — the
  holistic sheet and the open school's itinerary as `.xlsx`.
- *Save every session as a list* — one row per session as `.csv`, for anyone who
  wants the raw list rather than the laid-out sheet.
- *Download a backup* / *Restore from a backup* — the whole plan as
  one file. There's only one plan and it lives in the database, so this isn't a
  document format; it's there so a mistake big enough to want undoing after the
  fact can be undone.
- *Load the sample week* fills an empty plan with a few overlapping school stays
  so you can see how it all fits together; *Start fresh* empties it again. Both
  change the shared plan, so they ask first.

## Editing the catalogue

Activities, venues and staff training all started life in the source workbooks,
but everything is editable in the app — you don't need to touch the code.

- **Activities** → add, edit or remove. Name, colour, how long it runs, venue,
  how it's offered, and notes. The colour is the one that ends up on the grid
  and in every export, and the swatches offered are the fills the colour key
  already uses. There are no categories — with forty-odd activities, search
  finds one faster than a taxonomy does.
- **Venues** → add or edit spaces.
- **Staff** → *By person* lists every activity with a level you can set in one
  click; *Full matrix* is the dense grid from the training workbook, with the
  same colours, where clicking a cell steps through the levels.

Edits are stored as an **overlay** on the shipped data, not a copy of it. So
re-running the workbook import later refreshes everything you haven't
overridden, and a cell you've changed by hand is marked with a dot so the two
are easy to tell apart. Removing a seeded record hides it rather than destroying
it — **Restore removed** on the Activities page brings them back.

## Where the data lives

In a **Cloudflare D1 database** behind the site. One deployment holds one shared
plan, and it saves as you type — open the URL on any computer and you're looking
at the same thing, with no file to pass around and nothing to remember to save.

Both sites are in it. Woodhouse and Roonka are a column on a booking rather than
separate plans, which is what lets the whole-site views see across both, so the
picker in the toolbar changes what you're looking at, not what you're editing.

**Saving is row by row.** The app holds the whole plan in memory — that's what
undo works on — but each change is diffed against the one before it and only the
bookings and sessions that actually moved are sent. Two people planning
different schools at the same time don't overwrite each other. Within one row,
the last save wins.

Every write bumps a revision counter, and each browser checks it every ten
seconds and whenever you come back to the tab. Someone else's change appears in
front of you within about ten seconds, without a refresh.

**Losing the connection costs you nothing.** Changes queue up in your browser,
the toolbar badge turns grey and reads *Offline*, and everything goes out when
the connection is back — even if you closed the tab in the meantime. The badge
is the honest answer to "has that saved?": click it to retry straight away.

There's still no login, so put Cloudflare Access in front of the site —
[SETUP.md](SETUP.md#7-lock-it-down--do-this-one) is four clicks. It covers the
API as well as the pages.

[SETUP.md](SETUP.md#the-database) has the schema, how to query it and how to
take a backup — worth doing before **Program → Start fresh**, which empties the
plan for everyone.

## Running it locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

That's the interface on its own. It works — it just says **Offline** and keeps
everything in your browser, which is all you need for most interface work. For a
real database, run the API in a second terminal:

```bash
npm run db:schema:local   # once, to create the local tables
npm run dev:api           # Worker + a local D1 on port 8787
```

Other commands:

```bash
npm run build        # typecheck + production build into dist/
npm run preview      # build, then serve it exactly as deployed
npm run db:schema    # create/update the tables on the live database
npm run deploy       # build and push to Cloudflare
```

## How it's put together

```
src/
  types.ts                 domain model — read this first
  data/
    activities.ts          activity catalogue: the colour key, in code
    venues.ts              venues and accommodation
    staff.generated.ts     staff competency, generated from the training workbook
    staff.ts               expands the generated data
    resolve.ts             merges the seed catalogues with in-app edits
    templates.ts           day templates
    seed.ts                the sample week
  lib/
    time.ts                minutes-from-midnight helpers, loose time parsing
    term.ts                South Australian term and week labels
    colour.ts              turns one activity colour into a readable block palette
    rotation.ts            builds the Latin square, over one day or a whole stay
    layout.ts              works out where each block sits on the grid
    itinerary.ts           blocks → the row-per-start-time table both exports use
    xlsx.ts                a small .xlsx writer: fills, merges, widths
    excelExport.ts         the holistic and school sheets, as a workbook
    xlsxRead.ts            the matching reader: values, fills, merges
    importItinerary.ts     old workbooks → bookings and sessions
    exportImport.ts        CSV export and the shared title helpers
    backup.ts              whole-plan backup and restore
    api.ts                 the wire protocol: ops in, whole state out
  store/
    useStore.ts            document state, undo/redo
    sync.ts                diffs each change into rows and keeps D1 in step
    persist.ts             local storage: a cache, and the offline queue
    dragStore.ts           drag state + the grid registry
  hooks/
    useDragController.ts   the pointer handlers behind every drag
  components/
    pages/                 Staff, Activities and Venues management
    schedule/ week/        the grid, in both views
    panels/ print/ ui/     inspector, the print sheets, shared primitives
worker/
  index.ts                 the API: reads the plan, applies row-level changes
schema.sql                 the D1 tables
scripts/
  generate-staff.py        regenerates staff data from the .xlsx
```

A few decisions worth knowing about:

- **Times are minutes from midnight**, dates are `YYYY-MM-DD` local calendar
  days. No timezones anywhere — a camp day is a calendar day.
- **Nothing in the schedule points at a staff member.** Rostering is a separate
  job, so a block carries the activity, the groups, the time and the venue —
  and the model stays small enough to keep in your head.
- **Drag is hand-rolled** rather than a library. A time grid needs pixel-accurate
  snapping, edge resizing and drop targets computed from geometry; one custom
  pointer controller (`useDragController.ts`) does all three consistently.
- **Activity colours are exact on paper and softened on screen.** The colour key
  uses ~40 saturated fills, which is unreadable at screen density, so blocks
  render as a soft tint of the real colour with a saturated left rail. Exports
  and printed sheets use the colour itself, because that is the whole point of
  them.
- **One layout model for both exports.** `itinerary.ts` turns the free-form
  blocks back into the row-per-start-time table the sheets use, and the printed
  page and the spreadsheet both read from it — so they can't drift apart.
- **The .xlsx writer and reader are ours.** The sheets these replace mean
  nothing without their fills, so "export" had to mean a real workbook rather
  than a CSV that throws the colours away — and "import" had to mean reading
  those fills back, since half of what a cell means is its colour. Only the
  parts of the format those sheets use are implemented, which is about 250
  lines each way.
- **The importer trusts names over colours.** Several activities share a fill,
  so a colour alone is never enough to identify one: "Solo" printed in Nature
  Handicraft's yellow is still not Nature Handicraft. A name that *extends* a
  catalogue name — "Tube Slide OR" — counts as that activity when the colour
  agrees, and everything else becomes its own.
- **Undo snapshots the whole document.** A week of blocks is a few hundred
  objects — small enough that snapshotting is simpler and safer than diffing.
- **The app thinks in documents; the database thinks in rows.** Keeping whole
  `ProgramDocument`s in memory is what makes undo and every view simple. Saving
  them whole would mean one person's save silently discarding another's, so
  `sync.ts` diffs consecutive documents and sends only the rows that changed.
  One concept each way, and the join between them is forty lines.

# Where the data comes from

Everything in the app was taken from the existing spreadsheets so it looks and
behaves the way staff already expect. This is what came from where, and how to
change it.

---

## Activities

**Source:** the *Activities Colour Key* sheet (Week 1 / Week 10 Holistic
Itinerary) and the *Key + Activity Notes* sheet (Sample Itinerary).
**Lives in:** `src/data/activities.ts`

Carried across:

- **Colours**, cell for cell. `Bouldering` is `#ffc000`, `Challenge Hill` is
  `#ff3399`, `Team Challenges` is `#70ad47`. Where the sheet used an Excel theme
  colour rather than a literal RGB one, the theme has been resolved to its hex
  value — the Office theme, so accent2 `#ed7d31` for Laser Skirmish and accent6
  `#70ad47` for Team Challenges.
- **Durations** from the notes where stated (Photo Hunt 45 min, Orienteering
  45 min or 1.5 hr), otherwise the 90-minute slot the sheets use throughout.
- **Notes** from the "General Notes" column, shown on the activity in the
  palette and the inspector. They're guidance for whoever is planning, not
  rules the app enforces.

Added, because the app can use it and a spreadsheet can't:

- `venueIds` — which space the activity uses, so the itinerary can print it.
- `trainingNames` — the names the same activity goes by in the training
  workbook, so the Staff page can match sign-offs that are worded differently.

Colours in the code are **defaults**. Changing one on the Activities page stores
an override in the database, and that is what the app and its exports use from
then on — so the key can move on without a deploy.

On screen the colour is used as a soft tint plus a saturated left rail rather
than a solid fill, because forty saturated colours at screen density is
unreadable. Printed sheets and the Excel export use the colour itself, since
matching the existing workbooks is the whole point of them.

---

## Venues

**Source:** the location column of the *Activities Colour Key* sheet (Survivor
Shed, Bunk Pit, Ice Blocking Field, Brownsea, Craft Room, Wetland, St George
Field, Manor Creek, Henders Pit, Enviro Room…), plus the buildings named in the
booking headers of the holistic sheets. That column is colour-coded too; the
app doesn't use venue colours anywhere, so they weren't carried across.
**Lives in:** `src/data/venues.ts`

---

## Staff competency

**Source:** `WHProgram-StaffTraining.xlsx`, both the Woodhouse and Roonka sheets.
**Lives in:** `src/data/staff.generated.ts` (generated — don't edit by hand).

In the workbook the competency level is the **cell fill colour**, not the text;
the text records how many training sessions someone has had, or a note. Both are
carried across:

| Fill | Meaning | Stored as |
| --- | --- | --- |
| Green `#00B050` | I can train others | `trainer` |
| Light green `#92D050` | I can run it | `can_run` |
| Blue (Roonka only) | Can run at Woodhouse, not yet here | `can_run_elsewhere` |
| Yellow `#FFFF00` | Some training | `in_training` |
| Amber `#FFC000` | Wants to learn | `wants_to_learn` |
| Red `#FF0000` | Does not want to learn | `no` |

Only `trainer` and `can_run` count as signed off, which is what the per-person
count on the Staff page reports. Nothing else in the app reads it: the schedule
doesn't name staff, so this table answers "who can run Laser Skirmish?" and
leaves rostering to whoever does rostering.

People on both sheets are merged into one record with a per-site competency list,
so someone signed off for Survivor at Woodhouse but not at Roonka is handled
correctly.

### Editing it in the app

The **Staff** page edits all of this without touching the workbook. Changes are
stored as an overlay keyed by person, activity and site, so:

- Re-running the import below refreshes everything you *haven't* changed.
- A level set in the app is marked with a dot, so it's obvious which cells came
  from the workbook and which were changed since.
- Clicking a set level again clears the override and falls back to the workbook.

The same applies to **Activities** and **Venues** — edits and additions live in
the saved program, and removing a seeded record hides it rather than deleting
it.

### Regenerating it

After the workbook is updated:

```bash
pip install openpyxl                                  # once
python3 scripts/generate-staff.py path/to/WHProgram-StaffTraining.xlsx
npm run build
git add src/data/staff.generated.ts
git commit -m "Update staff training data"
git push
```

The script prints how many staff and entries it read. If that number looks wrong,
check the sheet's header row hasn't moved — `HEADER_ROW` near the top of the
script says which row holds the names (row 13 for Woodhouse, row 12 for Roonka).

### Name mismatches

The training workbook and the activity catalogue don't always use the same
wording. Where they differ, the activity carries the workbook's names in
`trainingNames` so the sign-off still matches:

| Workbook | Activity |
| --- | --- |
| `Laser Skirmish LIC`, `Laser Skirmish 2nd` | Laser Skirmish |
| `Adventures Trail` | Adventurer's Trail |
| `Labyrinth` | The Labyrinth |
| `Scats and Tracks` | Scats & Tracks |
| `Tube Slide LIC` | Tube Slide |
| `LW Cooking` | Lightweight Cooking |
| `Geocaching (Junior)`, `Geocaching (Senior)` | Geocaching |
| `Orienteering (45min)`, `Orienteering (1.5hrs)` | Orienteering |
| `Raft Building (junior)`, `Raft Building (senior)` | Raft Building |
| `Nature scavenger hunt and Echidna trail` | Echidna Trail & Nature Scavenger Hunt |
| `Water Adventurers` | Water Adventures |
| `Paddling (Expo)` | Paddling (Senior) |

When several sign-offs map to one activity, the **strongest** one wins.

Some workbook rows are deliberately not activities and have no catalogue entry —
`Office`, `Chemical Shed`, `School Holidays`, `LIC`, `Birthday Parties`,
`Team Building (adults)`. They're still in the data, just never scheduled.

**If you add an activity whose workbook name differs**, fill in *Also called (in
the training workbook)* on the Activities page — otherwise nobody will show as
qualified for it.

---

## Day templates

**Source:** the standard times used across the holistic sheets — 7:30am
breakfast, 10:30am morning tea, 12:30pm lunch, 3pm afternoon tea, 5:30pm dinner,
7:30pm evening activities, plus the arrival (10:30am) and departure (1:30pm)
patterns.
**Lives in:** `src/data/templates.ts`

---

## School terms

**Source:** published South Australian government school term dates.
**Lives in:** `src/lib/term.ts`

Camps are named by term week long before anyone looks up a date, so every date
label in the app carries one — "Term 3 Week 9" on the week bar, in the week
picker, and on the print headers. Week 1 is the week containing the first day of
term, so a Tuesday start still makes that whole week Week 1, which is how
schools count it.

`SA_TERM_DATES` holds one entry per year:

```ts
2026: [
  { start: '2026-01-27', end: '2026-04-10' },   // Term 1
  { start: '2026-04-27', end: '2026-07-03' },   // Term 2
  { start: '2026-07-20', end: '2026-09-25' },   // Term 3
  { start: '2026-10-12', end: '2026-12-11' },   // Term 4
],
```

**To add a year**, add its four terms to that object when the department
publishes them. Nothing else needs changing.

Years that aren't in the table still get labelled: the app falls back to the
pattern the department has used for decades — terms starting on the Monday
nearest 28 January, 28 April, 21 July and 13 October, running 11 / 10 / 10 / 9
weeks. An inferred label is marked with a `~` on the week bar so it's clear it
hasn't been checked against a published calendar.

Dates outside any term read as *School holidays*.

---

## What wasn't carried across

- **Staff rosters** (the *Itinerary — 3 groups + Staffing* sheet), deliberately.
  Nothing in the schedule names a staff member, so a session has no roster to
  print and the app has no opinion on who should run it. Rostering is a separate
  job; the **Staff** page is the reference table it would read from.
- **Set-up and pack-down times, capacities and staffing numbers.** These existed
  to feed scheduling checks the app no longer runs, so they aren't part of the
  activity any more. The notes column they came from is still carried across and
  still shown to whoever is planning.
- **Roonka-specific venues** are thinner than the Woodhouse list — the source
  sheet doesn't name locations for Roonka activities. Add them on the **Venues**
  page.
- **Junior programs.** The Woodhouse training sheet ends with
  *"JUNIOR Programs - add please"*, so there was nothing to import.

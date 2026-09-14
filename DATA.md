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

- **Colours**, verbatim. `Bouldering` is still `#ffc000`, `Challenge Hill` still
  `#ff3399`. On screen the colour is used as a soft tint plus a saturated left
  rail rather than a solid fill, because forty saturated colours at screen
  density is unreadable — but the hue you're used to is the hue you see.
- **Set-up and pack-down times** from the Sample Itinerary notes columns. These
  drive the *tight turnaround* check.
- **Clash rules** from the "General Notes" column. For example *"Don't run at the
  same time as Low Ropes"* on Bouldering + Gaga Ball became
  `conflictsWith: ['low-ropes']`.
- **Durations** from the notes where stated (Photo Hunt 45 min, Orienteering
  45 min or 1.5 hr), otherwise the 90-minute slot the sheets use throughout.

Added, because the app can use them and a spreadsheet can't:

- `venueIds` — which space the activity uses, so two schools can't be sent to the
  same place at once.
- `capacity` and `minStaff` — estimates, from the notes where stated. **Worth a
  review**; they only produce warnings, never blocks.
- `exclusive` — set on activities with a single set of equipment (Tube Slide,
  Laser Skirmish, Challenge Hill, Low Ropes, the kayaking activities).

---

## Venues

**Source:** the location column of the *Activities Colour Key* sheet (Survivor
Shed, Bunk Pit, Ice Blocking Field, Brownsea, Craft Room, Wetland, St George
Field, Manor Creek, Henders Pit, Enviro Room…), plus the buildings named in the
booking headers of the holistic sheets.
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

Only `trainer` and `can_run` count as signed off. The app warns — it never stops
you — when someone else is rostered on.

People on both sheets are merged into one record with a per-site competency list,
so someone signed off for Survivor at Woodhouse but not at Roonka is handled
correctly.

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

**If you add an activity whose workbook name differs**, add a `trainingNames`
array to it, or nobody will show as qualified.

---

## Day templates

**Source:** the standard times used across the holistic sheets — 7:30am
breakfast, 10:30am morning tea, 12:30pm lunch, 3pm afternoon tea, 5:30pm dinner,
7:30pm evening activities, plus the arrival (10:30am) and departure (1:30pm)
patterns.
**Lives in:** `src/data/templates.ts`

---

## What wasn't carried across

- **Staff rosters** (the *Itinerary — 3 groups + Staffing* sheet). The app
  assigns staff per session rather than as a shift, and can show each person's
  span from that. Shift times themselves aren't modelled yet.
- **Roonka-specific venues** are thinner than the Woodhouse list — the source
  sheet doesn't name locations for Roonka activities. Add them to
  `src/data/venues.ts` and clash detection will start covering them.
- **Junior programs.** The Woodhouse training sheet ends with
  *"JUNIOR Programs - add please"*, so there was nothing to import.

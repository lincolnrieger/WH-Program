# Woodhouse design system

The visual language of the Program Builder, pulled out of the code and tidied
into one set of tokens and rules.

- **`tokens.css`** — the new system: colour, type, weight, radius, elevation
  and motion tokens, light and dark. A drop-in for the token block in
  `src/index.css`.
- **`data/*.json`** — what the code uses today, measured by
  `scripts/extract-design-system.py`. Re-run it after a change to see the
  numbers move.

## What was there

| Area | Found | Notes |
| --- | --- | --- |
| Colour | 20 tokens × light/dark | Coherent: ink, surfaces, lines, brand, status. 4 defined but never used (`--surface-raised`, `--accent`, `--info`, `--info-tint`). |
| Type | 14 sizes, 7px–22px | All arbitrary `text-[Npx]` values; 9 of them sit within 1px of another. |
| Weight | 400 / 500 / 600 / 700 | 500 and 600 do almost all of the work. |
| Radius | 6 utilities + `--radius` | `--radius: 8px` is defined and never used. |
| Elevation | 3 shadows | `sm` cards, `md` menus, `lg` dialogs and the drag ghost. |
| Components | 9 primitives | `Button` (4 variants, 2 sizes), `IconButton`, `Input`, `Select`, `Field`, `SectionTitle`, `Chip`, `EmptyState`, `Modal`. |
| Activities | 59 colours | The spreadsheet's Excel fills, kept as hues; blocks render a tint with a saturated rail (`src/lib/colour.ts`). |

## What changes

**Colour.** Names and dark values stay. Two light values move to pass WCAG AA
for the small text they are used for:

| Token | Was | Now | On `--surface` |
| --- | --- | --- | --- |
| `--ink-faint` | `#7b8a82` | `#66756d` | 3.6 → 4.9 : 1 |
| `--accent` | `#b4622a` | `#a8571f` | 4.4 → 5.2 : 1 |

`--ink-faint` is the most used colour token (field labels, hints, section
titles at 10–11px), so its contrast matters most. `--surface-raised` becomes
the `Modal` background, as its name says; `--accent` and `--info` stay
reserved for highlights and info notices.

**Type** — eight named steps instead of fourteen pixel values:

| Step | Size | Replaces | Use |
| --- | --- | --- | --- |
| `text-2xs` | 10px | 7, 9, 9.5, 10px | Dense grid labels, badges |
| `text-xs` | 11px | 10.5, 11px | Field labels, section titles, chips |
| `text-sm` | 12px | 11.5, 12px | Secondary text, small buttons |
| `text-md` | 13px | 12.5, 13px | Controls and default UI text |
| `text-base` | 14px | 14px | Page body |
| `text-lg` | 16px | 15px | Dialog and empty-state titles |
| `text-xl` | 20px | 19px | Print headings |
| `text-2xl` | 24px | 22px | Print sheet title |

**Radius** — `rounded-sm` 4px (tags, cells), `rounded-md` 6px (buttons,
inputs), `rounded-lg` 8px (cards, blocks), `rounded-xl` 12px (dialogs),
`rounded-full` (chips, dots). Bare `rounded` becomes `rounded-sm`; the unused
`--radius` goes.

**Weights** — 400 body, 500 controls and chips, 600 titles and section
labels, 700 only for print headings and big figures.

**Motion** — `--duration-fast` (hover), `--duration-base` (panels),
`--duration-flash` (the new-block flash), `--ease-out`. Reduced-motion still
switches them off.

## Rules the components already follow

- Uppercase, tracked, `text-xs` `font-semibold` in `--ink-faint` for section
  titles and field labels.
- A control is 32px tall (`h-8`), 28px when `size="sm"` (`h-7`).
- Selected state is a `--brand-tint` fill with `--brand` text and border.
- Danger is a `--danger-tint` fill with `--danger` text, never a solid red.
- Focus is a 2px `--brand-soft` outline offset by 2px.
- Times and durations use `.tnum` so columns line up.
- Activity blocks: fill 84% towards white (76% towards the dark canvas in
  dark mode), the original colour as a rail, text picked by contrast. Every
  one of the 59 activities passes 7:1 for its block text in both themes.

## Migrating

1. Replace the `@theme`, `:root` and `:root[data-theme='dark']` blocks in
   `src/index.css` with `@import '../design-system/tokens.css';`.
2. Swap each `text-[Npx]` for its step from the table above.
3. Swap bare `rounded` for `rounded-sm`, and `bg-[var(--surface)]` on
   `Modal` for `bg-[var(--surface-raised)]`.

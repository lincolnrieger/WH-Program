#!/usr/bin/env python3
"""
Extracts the design system that the app actually uses from its source and
writes it as JSON under design-system/data/.

Run from the repository root:  python3 scripts/extract-design-system.py

It reads the tokens in src/index.css, counts how often each token and each
Tailwind size/radius/weight utility appears in src/, reads the primitives in
src/components/ui/, and derives the activity block palettes the same way
src/lib/colour.ts does. design-system/README.md explains the rationalised
system built from these numbers.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
OUT = ROOT / 'design-system' / 'data'

sources = {p: p.read_text() for p in SRC.rglob('*') if p.suffix in {'.ts', '.tsx', '.css'}}
code = '\n'.join(t for p, t in sources.items() if p.suffix in {'.ts', '.tsx'})
css = (SRC / 'index.css').read_text()


# ─── Colour maths, mirroring src/lib/colour.ts ──────────────────────────────

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexc(c):
    return '#' + ''.join(f'{round(min(255, max(0, v))):02x}' for v in c)


def lum(h):
    def ch(c):
        s = c / 255
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4
    r, g, b = rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return round((la + 0.05) / (lb + 0.05), 2)


def mix(a, b, t):
    a, b = rgb(a), rgb(b)
    return hexc([a[i] + (b[i] - a[i]) * t for i in range(3)])


def block_palette(colour, dark):
    rail = colour
    if lum(colour) < 0.06:
        rail = mix(colour, '#ffffff', 0.3)
    if lum(colour) > 0.85:
        rail = mix(colour, '#111111', 0.22)
    if dark:
        surface = mix(rail, '#161c1a', 0.76)
        return {'surface': surface, 'rail': rail, 'text': '#f2f6f3'}
    surface = mix(rail, '#ffffff', 0.84)
    return {'surface': surface, 'rail': rail, 'text': mix(rail, '#10231a', 0.72)}


# ─── Colour tokens ──────────────────────────────────────────────────────────

def block(selector):
    m = re.search(re.escape(selector) + r'\s*\{(.*?)\n\}', css, re.S)
    return dict(re.findall(r'--([\w-]+):\s*([^;]+);', m.group(1)))


light, dark = block(':root'), block(":root[data-theme='dark']")

# The rationalised values in design-system/tokens.css, beside what is in use.
new_css = (ROOT / 'design-system' / 'tokens.css').read_text()
new_light = dict(re.findall(r'--([\w-]+):\s*([^;]+);', re.search(r':root\s*\{(.*?)\n\}', new_css, re.S).group(1)))

GROUPS = {
    'ink': 'Text', 'canvas': 'Surface', 'surface': 'Surface', 'line': 'Border',
    'brand': 'Brand', 'accent': 'Brand', 'danger': 'Status', 'warn': 'Status',
    'info': 'Status', 'shadow': 'Elevation', 'radius': 'Shape',
}
ROLES = {
    'ink': 'Primary text', 'ink-soft': 'Secondary text, ghost buttons',
    'ink-faint': 'Labels, placeholders, hints', 'canvas': 'Page background',
    'surface': 'Cards, inputs, panels', 'surface-sunk': 'Hover fills, wells, sidebars',
    'surface-raised': 'Modals, popovers', 'line': 'Default borders and dividers',
    'line-strong': 'Emphasised borders, scrollbars', 'brand': 'Primary actions, active state',
    'brand-soft': 'Focus ring, focused borders', 'brand-tint': 'Selected / active fill',
    'brand-ink': 'Text on brand fills', 'accent': 'Highlights (terracotta)',
    'danger': 'Destructive text', 'danger-tint': 'Destructive fill', 'warn': 'Warning text',
    'warn-tint': 'Warning fill', 'info': 'Informational text', 'info-tint': 'Informational fill',
    'shadow-sm': 'Cards, chips', 'shadow-md': 'Menus', 'shadow-lg': 'Dialogs, drag ghost',
    'radius': 'Defined but unused',
}


def uses(name):
    # var() references in components and in the stylesheet's own rules.
    return len(re.findall(r'var\(--' + re.escape(name) + r'\)', code + css))


tokens = []
for name, value in light.items():
    group = GROUPS.get(name.split('-')[0], 'Other')
    row = {
        'token': f'--{name}', 'group': group, 'role': ROLES.get(name, ''),
        'light': value.strip(), 'dark': dark.get(name, value).strip(), 'uses': uses(name),
    }
    row['new_light'] = new_light.get(name, value).strip()
    if group in {'Text', 'Brand', 'Status'} and not name.endswith('tint'):
        # Text on brand fills is measured against the brand fill, the rest against cards.
        on = 'brand' if name == 'brand-ink' else 'surface'
        row['contrast_light'] = contrast(row['light'], light[on])
        row['contrast_dark'] = contrast(row['dark'], dark[on])
        row['new_contrast_light'] = contrast(row['new_light'], new_light[on].strip())
    tokens.append(row)

colour_tokens = [t for t in tokens if t['group'] not in {'Elevation', 'Shape'}]
shadows = [t for t in tokens if t['group'] == 'Elevation']
for s in shadows:
    s['uses'] = len(re.findall(r'var\(--' + s['token'][2:] + r'\)', code))


# ─── Typography ─────────────────────────────────────────────────────────────

# Each size in use, and the step of the new scale it folds into.
NEW_TYPE = [
    ('text-2xs', 10, 'Dense grid labels, badges'),
    ('text-xs', 11, 'Field labels, section titles, chips'),
    ('text-sm', 12, 'Secondary UI text, small buttons'),
    ('text-md', 13, 'Default control and body text'),
    ('text-base', 14, 'Page body (body default)'),
    ('text-lg', 16, 'Empty-state titles, dialog titles'),
    ('text-xl', 20, 'Print headings'),
    ('text-2xl', 24, 'Print sheet title'),
]


def step_for(px):
    return min(NEW_TYPE, key=lambda s: (abs(s[1] - px), -s[1]))[0]


sizes = {}
for px in re.findall(r'text-\[([\d.]+)px\]', code):
    sizes[float(px)] = sizes.get(float(px), 0) + 1
type_scale = [
    {'size': f'{px:g}px', 'px': px, 'uses': n, 'new_step': step_for(px)}
    for px, n in sorted(sizes.items())
]
new_type = []
for name, px, role in NEW_TYPE:
    folded = [t for t in type_scale if t['new_step'] == name]
    new_type.append({
        'token': name, 'px': px, 'role': role,
        'replaces': ', '.join(t['size'] for t in folded) or '—',
        'uses': sum(t['uses'] for t in folded),
    })

weights = [
    {'weight': w, 'value': v, 'uses': len(re.findall(r'\bfont-' + w + r'\b', code))}
    for w, v in [('normal', 400), ('medium', 500), ('semibold', 600), ('bold', 700)]
]


# ─── Radius ─────────────────────────────────────────────────────────────────

RADIUS = [  # Tailwind v4 defaults
    ('rounded-sm', 4, 'radius-sm'), ('rounded', 4, 'radius-sm'), ('rounded-md', 6, 'radius-md'),
    ('rounded-lg', 8, 'radius-lg'), ('rounded-xl', 12, 'radius-xl'), ('rounded-full', 9999, 'radius-full'),
]
radius = [
    {'class': c, 'px': px, 'new_token': t, 'uses': len(re.findall(r'(?<![\w-])' + re.escape(c) + r'(?![\w-])', code))}
    for c, px, t in RADIUS
]


# ─── Components ─────────────────────────────────────────────────────────────

prims = (SRC / 'components/ui/primitives.tsx').read_text()
components = []
for name in re.findall(r'export function (\w+)\(', prims):
    if name == 'cx':
        continue
    components.append({'component': name, 'file': 'src/components/ui/primitives.tsx',
                       'uses': len(re.findall(r'<' + name + r'\b', code))})
components.append({'component': 'Modal', 'file': 'src/components/ui/Modal.tsx',
                   'uses': len(re.findall(r'<Modal\b', code))})
variants = re.search(r"variant\?: ([^\n]+)", prims).group(1)
button_variants = [
    {'variant': v, 'uses': len(re.findall(r'variant="' + v + '"', code)) + (
        len(re.findall(r'<Button(?![^>]*variant=)[\s>]', code)) if v == 'default' else 0)}
    for v in re.findall(r"'(\w+)'", variants)
]


# ─── Activity palette ───────────────────────────────────────────────────────

acts = (SRC / 'data/activities.ts').read_text()
activities = []
for m in re.finditer(r"id: '([\w-]+)', name: (\"[^\"]+\"|'[^']+'), sites: \[([^\]]*)\],\s*colour: '(#[0-9a-fA-F]{6})'", acts):
    colour = m.group(4).lower()
    lp, dp = block_palette(colour, False), block_palette(colour, True)
    activities.append({
        'id': m.group(1), 'name': m.group(2)[1:-1],
        'site': ' + '.join(s.strip(" '").title() for s in m.group(3).split(',')),
        'colour': colour, 'rail': lp['rail'], 'surface_light': lp['surface'],
        'surface_dark': dp['surface'], 'text_contrast_light': contrast(lp['text'], lp['surface']),
        'text_contrast_dark': contrast(dp['text'], dp['surface']),
    })


OUT.mkdir(parents=True, exist_ok=True)
for name, rows in {
    'colour-tokens': colour_tokens, 'shadows': shadows, 'type-sizes': type_scale,
    'type-scale': new_type, 'font-weights': weights, 'radius': radius,
    'components': components, 'button-variants': button_variants, 'activities': activities,
}.items():
    (OUT / f'{name}.json').write_text(json.dumps(rows, indent=1) + '\n')
    print(f'{name}: {len(rows)} rows')

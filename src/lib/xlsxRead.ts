import { strFromU8, unzipSync } from 'fflate'

/**
 * A very small .xlsx reader — the counterpart to `xlsx.ts`.
 *
 * The itineraries being migrated in carry half their meaning in the cell fills,
 * so reading one means reading its colours, not just its text. Only what those
 * sheets use is implemented: shared strings, inline strings, numbers, dates,
 * solid fills (literal, theme-tinted or indexed) and merged ranges.
 */

export interface ReadCell {
  /** Text as it reads in the cell. Empty for a cell that only carries a fill. */
  text: string
  /** Solid background fill as `#rrggbb`, if the cell has one. */
  fill?: string
  /** Set when the cell holds a date, as an ISO `YYYY-MM-DD` calendar day. */
  date?: string
  /** Set when the cell holds a plain number. */
  number?: number
}

export interface MergedRange {
  row: number
  column: number
  /** Inclusive. */
  endRow: number
  endColumn: number
}

export interface ReadSheet {
  name: string
  /** Sparse: `rows[r][c]`, both zero-based. */
  rows: (ReadCell | undefined)[][]
  merges: MergedRange[]
}

export function readWorkbook(data: Uint8Array): ReadSheet[] {
  const files = unzipSync(data)
  const read = (path: string): string | undefined => {
    const entry = files[path]
    return entry ? strFromU8(entry) : undefined
  }

  const shared = parseSharedStrings(read('xl/sharedStrings.xml'))
  const theme = parseTheme(read('xl/theme/theme1.xml'))
  const styles = parseStyles(read('xl/styles.xml'), theme)

  const workbook = read('xl/workbook.xml') ?? ''
  const rels = parseRelationships(read('xl/_rels/workbook.xml.rels'))

  const sheets: ReadSheet[] = []
  for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const attrs = parseAttrs(match[1])
    const target = attrs['r:id'] ? rels[attrs['r:id']] : undefined
    const path = target
      ? `xl/${target.replace(/^\/?xl\//, '').replace(/^\//, '')}`
      : `xl/worksheets/sheet${sheets.length + 1}.xml`
    const xml = read(path) ?? read(`xl/worksheets/sheet${sheets.length + 1}.xml`)
    if (!xml) continue
    sheets.push({ name: decode(attrs.name ?? `Sheet${sheets.length + 1}`), ...parseSheet(xml, shared, styles) })
  }

  return sheets
}

// ─── parts ──────────────────────────────────────────────────────────────────

function parseRelationships(xml: string | undefined): Record<string, string> {
  const map: Record<string, string> = {}
  if (!xml) return map
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = parseAttrs(match[1])
    if (attrs.Id && attrs.Target) map[attrs.Id] = attrs.Target
  }
  return map
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  const out: string[] = []
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    // A string with mixed formatting is split across several <r><t> runs.
    let text = ''
    for (const run of match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += decode(run[1])
    out.push(text)
  }
  return out
}

/** The workbook's colour scheme, in the order style theme indexes refer to. */
function parseTheme(xml: string | undefined): string[] {
  const fallback = [
    'FFFFFF', '000000', 'E7E6E6', '44546A', '5B9BD5', 'ED7D31',
    'A5A5A5', 'FFC000', '4472C4', '70AD47', '0563C1', '954F72',
  ]
  if (!xml) return fallback

  const scheme = /<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(xml)?.[0]
  if (!scheme) return fallback

  const colours: string[] = []
  for (const tag of ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']) {
    const block = new RegExp(`<a:${tag}>([\\s\\S]*?)</a:${tag}>`).exec(scheme)?.[1] ?? ''
    const srgb = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(block)?.[1]
    const sys = /<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/.exec(block)?.[1]
    colours.push((srgb ?? sys ?? '000000').toUpperCase())
  }

  // Style theme indexes swap the first two pairs relative to the scheme order:
  // 0 is the light background, 1 the dark text, and so on.
  const [dk1, lt1, dk2, lt2, ...rest] = colours
  return [lt1, dk1, lt2, dk2, ...rest]
}

interface Styles {
  /** Fill colour per cell-format index. */
  fills: (string | undefined)[]
  /** Whether the cell format is a date format. */
  dates: boolean[]
}

function parseStyles(xml: string | undefined, theme: string[]): Styles {
  if (!xml) return { fills: [], dates: [] }

  const dateFormats = new Set<number>([
    14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
    45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58,
  ])
  for (const match of xml.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
    const attrs = parseAttrs(match[1])
    const id = Number(attrs.numFmtId)
    const code = decode(attrs.formatCode ?? '')
    // Strip quoted literals and colour/condition blocks before looking for
    // date tokens, so a currency format like [Red]"m"#,##0 isn't a false match.
    const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')
    if (Number.isFinite(id) && /[ymd]/i.test(bare) && !/^[^ymd]*$/i.test(bare)) dateFormats.add(id)
  }

  const fillBlock = /<fills\b[\s\S]*?<\/fills>/.exec(xml)?.[0] ?? ''
  const fillColours: (string | undefined)[] = []
  for (const match of fillBlock.matchAll(/<fill>([\s\S]*?)<\/fill>|<fill\/>/g)) {
    fillColours.push(solidFill(match[1] ?? '', theme))
  }

  const xfBlock = /<cellXfs\b[\s\S]*?<\/cellXfs>/.exec(xml)?.[0] ?? ''
  const fills: (string | undefined)[] = []
  const dates: boolean[] = []
  for (const match of xfBlock.matchAll(/<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g)) {
    const attrs = parseAttrs(match[1])
    fills.push(fillColours[Number(attrs.fillId ?? 0)])
    dates.push(dateFormats.has(Number(attrs.numFmtId ?? 0)))
  }

  return { fills, dates }
}

function solidFill(xml: string, theme: string[]): string | undefined {
  if (!/patternType="solid"/.test(xml)) return undefined
  const fg = /<fgColor\b([^>]*)\/?>/.exec(xml)
  if (!fg) return undefined
  const attrs = parseAttrs(fg[1])

  if (attrs.rgb && attrs.rgb !== '00000000') {
    const hex = attrs.rgb.length === 8 ? attrs.rgb.slice(2) : attrs.rgb
    return `#${hex.toLowerCase()}`
  }
  if (attrs.theme !== undefined) {
    const base = theme[Number(attrs.theme)] ?? '000000'
    return `#${applyTint(base, Number(attrs.tint ?? 0)).toLowerCase()}`
  }
  if (attrs.indexed !== undefined) {
    const indexed = INDEXED_COLOURS[Number(attrs.indexed)]
    return indexed ? `#${indexed.toLowerCase()}` : undefined
  }
  return undefined
}

/** Excel's tint: positive lightens towards white, negative darkens towards black. */
function applyTint(hex: string, tint: number): string {
  if (!tint) return hex
  const channel = (value: number) =>
    Math.round(tint >= 0 ? value + (255 - value) * tint : value * (1 + tint))
  const r = channel(parseInt(hex.slice(0, 2), 16))
  const g = channel(parseInt(hex.slice(2, 4), 16))
  const b = channel(parseInt(hex.slice(4, 6), 16))
  return [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}

/** The handful of legacy indexed colours these sheets actually use. */
const INDEXED_COLOURS: Record<number, string> = {
  0: '000000', 1: 'FFFFFF', 2: 'FF0000', 3: '00FF00', 4: '0000FF', 5: 'FFFF00',
  6: 'FF00FF', 7: '00FFFF', 8: '000000', 9: 'FFFFFF', 10: 'FF0000', 11: '00FF00',
  12: '0000FF', 13: 'FFFF00', 14: 'FF00FF', 15: '00FFFF', 43: 'CCFFCC',
  44: 'FFFF99', 45: '99CCFF', 46: 'FF99CC', 47: 'CC99FF', 51: '993300',
  52: '333300', 53: 'FF6600', 55: '333399', 56: '333333', 64: '000000',
}

// ─── worksheets ─────────────────────────────────────────────────────────────

function parseSheet(
  xml: string,
  shared: string[],
  styles: Styles,
): { rows: (ReadCell | undefined)[][]; merges: MergedRange[] } {
  const rows: (ReadCell | undefined)[][] = []

  const body = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml)?.[1] ?? ''
  for (const rowMatch of body.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowAttrs = parseAttrs(rowMatch[1])
    const rowIndex = Number(rowAttrs.r ?? rows.length + 1) - 1
    const cells: (ReadCell | undefined)[] = rows[rowIndex] ?? []

    for (const cellMatch of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = parseAttrs(cellMatch[1])
      const ref = parseRef(attrs.r)
      if (!ref) continue

      const styleIndex = Number(attrs.s ?? 0)
      const cell = readCell(attrs.t, cellMatch[2] ?? '', shared, styles, styleIndex)
      if (cell) cells[ref.column] = cell
    }

    rows[rowIndex] = cells
  }

  const merges: MergedRange[] = []
  for (const match of xml.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+\d+:[A-Z]+\d+)"/g)) {
    const [from, to] = match[1].split(':')
    const a = parseRef(from)
    const b = parseRef(to)
    if (a && b) merges.push({ row: a.row, column: a.column, endRow: b.row, endColumn: b.column })
  }

  return { rows, merges }
}

function readCell(
  type: string | undefined,
  body: string,
  shared: string[],
  styles: Styles,
  styleIndex: number,
): ReadCell | undefined {
  const fill = styles.fills[styleIndex]

  let text = ''
  if (type === 'inlineStr') {
    for (const run of body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += decode(run[1])
  } else {
    const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
    if (raw !== undefined) {
      if (type === 's') text = shared[Number(raw)] ?? ''
      else if (type === 'str') text = decode(raw)
      else if (type === 'b') text = raw === '1' ? 'TRUE' : 'FALSE'
      else text = decode(raw)
    }
  }

  const cell: ReadCell = { text: text.trim(), fill }

  if (!type || type === 'n') {
    const value = Number(text)
    if (text !== '' && Number.isFinite(value)) {
      cell.number = value
      if (styles.dates[styleIndex]) {
        cell.date = serialToISO(value)
        cell.text = cell.date
      }
    }
  }

  if (!cell.text && !cell.fill) return undefined
  return cell
}

/**
 * Excel's day numbering starts at 1899-12-30, which absorbs its belief that
 * 1900 was a leap year.
 */
function serialToISO(serial: number): string {
  const days = Math.floor(serial)
  const date = new Date(Date.UTC(1899, 11, 30))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// ─── helpers ────────────────────────────────────────────────────────────────

function parseAttrs(source: string | undefined): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (!source) return attrs
  for (const match of source.matchAll(/([\w:]+)="([^"]*)"/g)) attrs[match[1]] = match[2]
  return attrs
}

export function parseRef(ref: string | undefined): { row: number; column: number } | undefined {
  if (!ref) return undefined
  const match = /^([A-Z]+)(\d+)$/.exec(ref)
  if (!match) return undefined
  let column = 0
  for (const character of match[1]) column = column * 26 + (character.charCodeAt(0) - 64)
  return { row: Number(match[2]) - 1, column: column - 1 }
}

function decode(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

/** Reads every `.xlsx` in a `.zip`, ignoring anything else it contains. */
export function readZip(data: Uint8Array): { name: string; sheets: ReadSheet[] }[] {
  const files = unzipSync(data)
  const out: { name: string; sheets: ReadSheet[] }[] = []

  for (const [path, content] of Object.entries(files)) {
    // Skip directory entries, macOS resource forks and Excel lock files.
    if (!/\.xlsx$/i.test(path)) continue
    if (/(^|\/)(__MACOSX|\.)/.test(path) || /(^|\/)~\$/.test(path)) continue
    try {
      out.push({ name: path.split('/').pop() ?? path, sheets: readWorkbook(content) })
    } catch {
      // One unreadable workbook shouldn't stop the rest of the archive.
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}

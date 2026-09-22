import { strToU8, zipSync } from 'fflate'

/**
 * A very small .xlsx writer.
 *
 * The itineraries this app replaces are Excel files whose whole meaning is in
 * the cell fills, so "export" has to mean a real workbook rather than a CSV
 * that throws the colours away. Only the parts of the format those sheets use
 * are implemented: inline strings, solid fills, fonts, thin borders, wrapped
 * text, merged ranges, column widths, row heights and landscape page setup.
 */

export interface CellStyle {
  /** Solid background fill, as `#rrggbb`. */
  fill?: string
  /** Font colour, as `#rrggbb`. */
  colour?: string
  bold?: boolean
  italic?: boolean
  /** Points. Defaults to 11. */
  size?: number
  wrap?: boolean
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'center' | 'bottom'
  /** Thin box border on all four sides. */
  border?: boolean
}

export interface Cell {
  value?: string | number
  style?: CellStyle
}

export interface SheetRow {
  cells: (Cell | null | undefined)[]
  /** Row height in points. */
  height?: number
}

export interface Sheet {
  name: string
  rows: SheetRow[]
  /** Merged ranges in A1 notation, e.g. `B1:C1`. */
  merges?: string[]
  /** Column widths, in Excel's character units, left to right. */
  columns?: number[]
  landscape?: boolean
}

/** 0 → `A`, 25 → `Z`, 26 → `AA`. */
export function columnName(index: number): string {
  let name = ''
  let n = index
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name
    n = Math.floor(n / 26) - 1
  }
  return name
}

export function cellRef(row: number, column: number): string {
  return `${columnName(column)}${row + 1}`
}

function xml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Excel wants `FFRRGGBB`; the app stores `#rrggbb`. */
function argb(hex: string): string {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  return `FF${full.toUpperCase()}`
}

/** Sheet names can't exceed 31 characters or contain `[]:*?/\`. */
function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet'
}

// ─── style registry ─────────────────────────────────────────────────────────

/**
 * Collects the distinct fonts, fills and formats used across the workbook.
 *
 * Excel addresses styles by index, so every unique combination has to be
 * registered up front and referenced by number from the cells that use it.
 */
class Styles {
  /** Indices 0 and 1 are reserved by the format for "none" and "gray125". */
  private fills: string[] = ['none', 'gray125']
  private fonts: string[] = ['default']
  private formats: string[] = ['0:0:0:']
  private fontXml: string[] = ['<font><sz val="11"/><name val="Calibri"/></font>']
  private fillXml: string[] = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ]

  /** Returns the `s` attribute to put on a cell using this style. */
  index(style: CellStyle | undefined): number {
    if (!style) return 0

    const fontKey = `${style.bold ? 'b' : ''}${style.italic ? 'i' : ''}${style.size ?? 11}${style.colour ?? ''}`
    let fontId = this.fonts.indexOf(fontKey)
    if (fontId === -1) {
      fontId = this.fonts.push(fontKey) - 1
      this.fontXml.push(
        '<font>' +
          `<sz val="${style.size ?? 11}"/>` +
          (style.bold ? '<b/>' : '') +
          (style.italic ? '<i/>' : '') +
          (style.colour ? `<color rgb="${argb(style.colour)}"/>` : '') +
          '<name val="Calibri"/>' +
          '</font>',
      )
    }

    let fillId = 0
    if (style.fill) {
      const key = argb(style.fill)
      fillId = this.fills.indexOf(key)
      if (fillId === -1) {
        fillId = this.fills.push(key) - 1
        this.fillXml.push(
          `<fill><patternFill patternType="solid"><fgColor rgb="${key}"/><bgColor indexed="64"/></patternFill></fill>`,
        )
      }
    }

    const borderId = style.border ? 1 : 0
    const alignment =
      style.wrap || style.align || style.valign
        ? `<alignment${style.align ? ` horizontal="${style.align}"` : ''}` +
          `${style.valign ? ` vertical="${style.valign}"` : ''}` +
          `${style.wrap ? ' wrapText="1"' : ''}/>`
        : ''

    const key = `${fontId}:${fillId}:${borderId}:${alignment}`
    const existing = this.formats.indexOf(key)
    if (existing !== -1) return existing
    return this.formats.push(key) - 1
  }

  toXml(): string {
    const xfs = this.formats.map((key) => {
      const [fontId, fillId, borderId, ...rest] = key.split(':')
      const alignment = rest.join(':')
      return (
        `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
        `${fontId !== '0' ? ' applyFont="1"' : ''}` +
        `${fillId !== '0' ? ' applyFill="1"' : ''}` +
        `${borderId !== '0' ? ' applyBorder="1"' : ''}` +
        `${alignment ? ' applyAlignment="1"' : ''}` +
        (alignment ? `>${alignment}</xf>` : '/>')
      )
    })

    const thin = '<color rgb="FF808080"/>'
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${this.fontXml.length}">${this.fontXml.join('')}</fonts>` +
      `<fills count="${this.fillXml.length}">${this.fillXml.join('')}</fills>` +
      '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      `<border><left style="thin">${thin}</left><right style="thin">${thin}</right>` +
      `<top style="thin">${thin}</top><bottom style="thin">${thin}</bottom><diagonal/></border>` +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    )
  }
}

// ─── worksheets ─────────────────────────────────────────────────────────────

function sheetXml(sheet: Sheet, styles: Styles): string {
  const width = Math.max(1, ...sheet.rows.map((row) => row.cells.length))

  const cols = sheet.columns?.length
    ? '<cols>' +
      sheet.columns
        .map((w, index) => `<col min="${index + 1}" max="${index + 1}" width="${w}" customWidth="1"/>`)
        .join('') +
      `<col min="${sheet.columns.length + 1}" max="16384" width="${
        sheet.columns[sheet.columns.length - 1]
      }"/>` +
      '</cols>'
    : ''

  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row.cells
        .map((cell, columnIndex) => {
          if (!cell || (cell.value === undefined && !cell.style)) return ''
          const ref = cellRef(rowIndex, columnIndex)
          const s = styles.index(cell.style)
          const attrs = `r="${ref}"${s ? ` s="${s}"` : ''}`
          if (cell.value === undefined || cell.value === '') return `<c ${attrs}/>`
          if (typeof cell.value === 'number') return `<c ${attrs}><v>${cell.value}</v></c>`
          return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`
        })
        .join('')

      const height = row.height ? ` ht="${row.height}" customHeight="1"` : ''
      return `<row r="${rowIndex + 1}"${height}>${cells}</row>`
    })
    .join('')

  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges
        .map((ref) => `<mergeCell ref="${ref}"/>`)
        .join('')}</mergeCells>`
    : ''

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${columnName(Math.max(width - 1, 0))}${Math.max(sheet.rows.length, 1)}"/>` +
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    cols +
    `<sheetData>${rows}</sheetData>` +
    merges +
    '<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>' +
    `<pageSetup paperSize="9" orientation="${sheet.landscape === false ? 'portrait' : 'landscape'}" fitToWidth="1" fitToHeight="0"/>` +
    '</worksheet>'
  )
}

/** Builds a workbook and returns it as a downloadable blob. */
export function buildWorkbook(sheets: Sheet[]): Blob {
  const styles = new Styles()
  // Worksheets are rendered first so every style they use is registered before
  // the style table is written out.
  const worksheets = sheets.map((sheet) => sheetXml(sheet, styles))

  const sheetRels = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('')

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets
          .map(
            (_, index) =>
              `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets>' +
        sheets
          .map(
            (sheet, index) =>
              `<sheet name="${xml(sheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
          )
          .join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheetRels +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(styles.toXml()),
  }

  worksheets.forEach((content, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(content)
  })

  return new Blob([zipSync(files, { level: 6 }) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

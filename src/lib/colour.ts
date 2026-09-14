/**
 * Colour helpers.
 *
 * The existing spreadsheets use ~40 fully saturated fills, which is legible in
 * Excel but overwhelming on a dense screen grid. We keep each activity's hue —
 * that's the shared visual language staff already know — but render blocks as a
 * soft tint with a saturated left rail, and pick text colour by contrast.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const int = parseInt(full, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** Relative luminance per WCAG 2.1. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/** Black or white, whichever reads better on `background`. */
export function readableText(background: string): string {
  return contrastRatio(background, '#ffffff') >= 3.2 ? '#ffffff' : '#10231a'
}

export function mix(hex: string, towards: string, amount: number): string {
  const a = hexToRgb(hex)
  const b = hexToRgb(towards)
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  })
}

export interface BlockPalette {
  /** Card background — a soft tint of the activity colour. */
  surface: string
  /** Saturated rail down the left edge, keeping the original hue recognisable. */
  rail: string
  /** Card border. */
  border: string
  /** Body text colour with adequate contrast on `surface`. */
  text: string
  /** Muted secondary text (time, venue). */
  muted: string
}

/**
 * Derives a readable block palette from one activity colour. Very dark and very
 * light source colours are pulled towards mid-tone first so the rail stays
 * visible against both the card and the page.
 */
export function blockPalette(colour: string, dark: boolean): BlockPalette {
  const lum = luminance(colour)
  let rail = colour
  if (lum < 0.06) rail = mix(colour, '#ffffff', 0.3)
  if (lum > 0.85) rail = mix(colour, '#111111', 0.22)

  if (dark) {
    const surface = mix(rail, '#161c1a', 0.76)
    return {
      surface,
      rail,
      border: mix(rail, '#161c1a', 0.55),
      text: '#f2f6f3',
      muted: mix('#f2f6f3', surface, 0.42),
    }
  }

  const surface = mix(rail, '#ffffff', 0.84)
  return {
    surface,
    rail,
    border: mix(rail, '#ffffff', 0.58),
    text: mix(rail, '#10231a', 0.72),
    muted: mix(rail, '#5c6b63', 0.6),
  }
}

/** Deterministic fallback colour for custom blocks with no activity behind them. */
export function colourFromString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return hslToHex(hue, 55, 45)
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1))
  return rgbToHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 })
}

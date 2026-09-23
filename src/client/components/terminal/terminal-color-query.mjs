const ESC = '\x1b'
const ST = '\x1b\\'

function toHexByte (value) {
  return value.toString(16).padStart(2, '0')
}

function clampByte (value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function parseChannel (value) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.endsWith('%')) {
    const percent = Number(trimmed.slice(0, -1))
    return Number.isFinite(percent)
      ? clampByte(percent * 255 / 100)
      : null
  }
  const num = Number(trimmed)
  return Number.isFinite(num)
    ? clampByte(num)
    : null
}

function parseAlpha (value) {
  if (!value) {
    return 1
  }
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) {
    const percent = Number(trimmed.slice(0, -1))
    return Number.isFinite(percent) ? percent / 100 : null
  }
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

function parseHexColor (color) {
  const match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (!match) {
    return null
  }
  const raw = match[1]
  const expanded = raw.length <= 4
    ? raw.split('').map(char => char + char).join('')
    : raw
  const alpha = expanded.length === 8
    ? parseInt(expanded.slice(6, 8), 16) / 255
    : 1
  if (alpha <= 0) {
    return null
  }
  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16),
    alpha
  ]
}

function parseRgbColor (color) {
  const match = color.match(/^rgba?\((.*)\)$/i)
  if (!match) {
    return null
  }
  const body = match[1].trim()
  const [channelsPart, slashAlpha] = body.split('/').map(part => part.trim())
  const parts = channelsPart.includes(',')
    ? channelsPart.split(',').map(part => part.trim())
    : channelsPart.split(/\s+/).filter(Boolean)
  if (parts.length < 3) {
    return null
  }
  const channels = parts.slice(0, 3).map(parseChannel)
  if (channels.some(channel => channel === null)) {
    return null
  }
  const alpha = parseAlpha(slashAlpha || parts[3])
  if (alpha === null || alpha <= 0) {
    return null
  }
  return [...channels, alpha]
}

export function parseColorToRgb (color) {
  const rgba = parseColorToRgba(color)
  return rgba ? rgba.slice(0, 3) : null
}

export function parseColorToRgba (color) {
  if (typeof color !== 'string') {
    return null
  }
  const trimmed = color.trim()
  if (!trimmed || trimmed.toLowerCase() === 'transparent') {
    return null
  }
  return parseHexColor(trimmed) || parseRgbColor(trimmed)
}

export function colorToOscRgb (color) {
  const rgb = parseColorToRgb(color)
  if (!rgb) {
    return ''
  }
  return `rgb:${rgb.map(toHexByte).join('/')}`
}

/**
 * Blend a (possibly translucent) selection colour over an opaque background,
 * producing the colour in xterm's internal format ({ css, rgba } where
 * rgba = r<<24 | g<<16 | b<<8 | a).
 *
 * xterm derives its DOM selection colour as blend(theme.background,
 * selectionBackground) into `selectionBackgroundOpaque`, and separately forces
 * any opaque selectionBackground down to 0.3 alpha in
 * `selectionBackgroundTransparent` (xterm#2737). electerm renders the terminal
 * background via CSS and hands xterm a transparent background, so the blend
 * must be redone over the real visible background — starting from the
 * *configured* colour so an opaque selection stays opaque (xterm's forced
 * 0.3-alpha variant would make every selection translucent).
 *
 * `selectionColor` is a CSS colour string from the terminal theme, e.g.
 * themeConfig.selectionBackground; `visibleBackground` is an opaque colour
 * string.
 */
export function blendSelectionOverBackground (visibleBackground, selectionColor) {
  const bg = parseColorToRgb(visibleBackground)
  const sel = parseColorToRgba(selectionColor)
  if (!bg || !sel) {
    return null
  }
  const [br, bgg, bb] = bg
  const [sr, sg, sb, sa] = sel
  const toCss = (r, g, b, alpha) =>
    `#${[r, g, b, alpha].map(toHexByte).join('')}`
  if (sa >= 1) {
    // Fully opaque: use the configured colour as-is, just normalised to
    // 8-digit hex so both the overlay and per-cell inline styles agree.
    return {
      css: toCss(sr, sg, sb, 255),
      rgba: (sr << 24 | sg << 16 | sb << 8 | 255) >>> 0
    }
  }
  const r = br + Math.round((sr - br) * sa)
  const g = bgg + Math.round((sg - bgg) * sa)
  const b = bb + Math.round((sb - bb) * sa)
  const alpha = Math.round(sa * 255)
  return {
    css: toCss(r, g, b, alpha),
    rgba: (r << 24 | g << 16 | b << 8 | alpha) >>> 0
  }
}

export function buildOscColorResponse (identifier, color, fallbackColor) {
  const oscColor = colorToOscRgb(color) || colorToOscRgb(fallbackColor)
  return oscColor
    ? `${ESC}]${identifier};${oscColor}${ST}`
    : ''
}

export function handleTerminalColorQuery (terminal, identifier, color, fallbackColor, data) {
  if (typeof data !== 'string' || data.trim() !== '?') {
    return false
  }
  const response = buildOscColorResponse(identifier, color, fallbackColor)
  if (!response || typeof terminal?.input !== 'function') {
    return false
  }
  terminal.input(response, false)
  return true
}

export function createRendererThemeConfig (themeConfig = {}, rendererType, visibleBackground) {
  return {
    ...themeConfig,
    background: rendererType === 'webGL' && colorToOscRgb(visibleBackground)
      ? visibleBackground
      : 'rgba(0,0,0,0)'
  }
}

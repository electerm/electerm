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
    parseInt(expanded.slice(4, 6), 16)
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
  return channels
}

export function parseColorToRgb (color) {
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

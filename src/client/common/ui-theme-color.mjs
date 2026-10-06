/**
 * Colour maths for the UI theme's derived variables (`--main-darker`,
 * `--main-lighter`).
 *
 * These used to be computed by stylus at build time (`darken(main, 30%)`), so
 * the runtime replacement has to produce the same values -- otherwise a theme
 * renders differently depending on which side of the refactor computed it.
 * Both halves below deliberately mirror stylus's own implementation, float
 * ordering included (lib/nodes/hsla.js `fromRGBA`, lib/nodes/rgba.js
 * `fromHSLA`, lib/functions/adjust.js): the two agree only up to the last bit,
 * and that bit decides a rounded channel.
 */

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * Parse `#rgb` / `#rrggbb` into `[r, g, b]` (0-255), or null when the value is
 * not a hex colour (a theme value may be `rgba(...)`, a name, etc).
 * @param {string} color
 * @return {Array|null}
 */
function parseHex (color) {
  const m = HEX_RE.exec(String(color).trim())
  if (!m) {
    return null
  }
  let hex = m[1]
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  const num = parseInt(hex, 16)
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
}

/**
 * `HSLA.fromRGBA` -- h in degrees (may come back negative, as stylus leaves
 * it), s and l in percent.
 * @param {Array} rgb [r, g, b] 0-255
 * @return {Array} [h, s, l]
 */
function rgbToHsl ([r, g, b]) {
  r /= 255
  g /= 255
  b /= 255
  const min = Math.min(r, g, b)
  const max = Math.max(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  switch (max) {
    case min: h = 0; break
    case r: h = 60 * (g - b) / d; break
    case g: h = 60 * (b - r) / d + 120; break
    case b: h = 60 * (r - g) / d + 240; break
  }
  if (max === min) {
    s = 0
  } else if (l < 0.5) {
    s = d / (2 * l)
  } else {
    s = d / (2 - 2 * l)
  }
  h %= 360
  return [h, s * 100, l * 100]
}

/**
 * `RGBA.fromHSLA` -- note this is the `m1`/`m2`/`hue()` form, not the usual
 * chroma/hue-sector form; the two disagree by one ulp and therefore
 * occasionally by one channel.
 * @param {number} h degrees
 * @param {number} s percent
 * @param {number} l percent
 * @return {Array} [r, g, b] 0-255
 */
function hslToRgb (h, s, l) {
  h /= 360
  s /= 100
  l /= 100
  const m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s
  const m1 = l * 2 - m2
  const hue = (x) => {
    if (x < 0) ++x
    if (x > 1) --x
    if (x * 6 < 1) return m1 + (m2 - m1) * x * 6
    if (x * 2 < 1) return m2
    if (x * 3 < 2) return m1 + (m2 - m1) * (2 / 3 - x) * 6
    return m1
  }
  return [
    hue(h + 1 / 3),
    hue(h),
    hue(h - 1 / 3)
  ].map(v => Math.max(0, Math.min(Math.round(v * 0xff), 255)))
}

/**
 * Move a colour's HSL lightness by `percent`, replicating stylus's
 * `adjust(color, 'lightness', ...)` -- the function behind `darken()` /
 * `lighten()` (see stylus/lib/functions/adjust.js). For a percentage `p`:
 *
 *   p > 0 (lighten): l += (100 - l) * p / 100   -- approaches 100 asymptotically
 *   p < 0 (darken):  l += l * (p / 100)         -- multiplicative, never clamps
 *
 * The multiplication is the important half: `darken(c, 30%)` is `0.7 * l`, so a
 * near-black colour stays a near-black of the same hue. Subtracting a flat
 * amount per channel instead (the previous implementation) drove every channel
 * of a dark colour to 0 and produced pure black.
 *
 * @param {string} color hex colour
 * @param {number} percent positive lightens, negative darkens
 * @return {string} hex colour, or `color` unchanged when it is not hex
 */
export function adjustLightness (color, percent) {
  const rgb = parseHex(color)
  if (!rgb || !percent) {
    return color
  }
  const [h, s, l] = rgbToHsl(rgb)
  const delta = percent > 0
    ? (100 - l) * percent / 100
    : l * (percent / 100)
  return '#' + hslToRgb(h, s, l + delta)
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * @param {string} color hex colour
 * @param {number} amount fraction: 0.3 = 30% darker, -0.3 = 30% lighter
 * @return {string} hex colour
 */
export function darker (color, amount = 0.1) {
  return adjustLightness(color, -amount * 100)
}

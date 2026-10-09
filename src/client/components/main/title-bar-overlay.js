/**
 * Windows + system title bar: the native min/max/close buttons are drawn by
 * Windows over the top-right of the tab bar (window controls overlay). Keep
 * their background/symbol colors in step with the UI theme, and with the
 * tab bar's see-through when opacity/blur is on, so they blend into the tabs.
 */

import { useEffect } from 'react'

// '#abc' | '#aabbcc' | '#aabbccdd' -> [r, g, b, a(0-1)], or null
export function parseHexColor (color = '') {
  let hex = String(color).trim().replace(/^#/, '')
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.split('').map(c => c + c).join('')
  }
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
    return null
  }
  const n = i => parseInt(hex.slice(i, i + 2), 16)
  return [n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1]
}

const toHex = v => Math.round(v).toString(16).padStart(2, '0')

// overlay colors for a UI theme; alpha follows the window opacity when the
// page is see-through (opacity < 1 or a backdrop material)
export function getOverlayColors (themeConfig = {}, opacity = 1, seeThrough = false) {
  const bg = parseHexColor(themeConfig['main-dark']) || [0, 0, 0, 1]
  const fg = parseHexColor(themeConfig.text) || [221, 221, 221, 1]
  const alpha = seeThrough ? bg[3] * opacity : bg[3]
  return {
    color: '#' + bg.slice(0, 3).map(toHex).join('') + toHex(alpha * 255),
    symbolColor: '#' + fg.slice(0, 3).map(toHex).join('')
  }
}

export default function TitleBarOverlay ({ themeConfig, opacity = 1, material = 'none' }) {
  const seeThrough = opacity < 1 || material !== 'none'
  const { color, symbolColor } = getOverlayColors(themeConfig, opacity, seeThrough)

  useEffect(() => {
    window.pre.runGlobalAsync('setTitleBarOverlay', { color, symbolColor })
  }, [color, symbolColor])

  return null
}

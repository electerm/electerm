/**
 * Windows + system title bar: the native min/max/close buttons are drawn by
 * Windows over the top-right of the tab bar (window controls overlay). Keep
 * their background/symbol colors in step with the UI theme so they blend into
 * the tabs.
 */

import { useEffect } from 'react'

// '#abc' | '#aabbcc' | '#aabbccdd' -> [r, g, b], or null. The alpha channel
// (8-digit form) is tolerated but dropped — see getOverlayColors.
export function parseHexColor (color = '') {
  let hex = String(color).trim().replace(/^#/, '')
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.split('').map(c => c + c).join('')
  }
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
    return null
  }
  const n = i => parseInt(hex.slice(i, i + 2), 16)
  return [n(0), n(2), n(4)]
}

const toHex = v => Math.round(v).toString(16).padStart(2, '0')

// Overlay colors for a UI theme. Always opaque: in WCO mode the window is
// created with transparent: false (create-window.js), so nothing can show
// through the overlay area, and following config.opacity here would only make
// the caption strip disagree with the tab bar it sits on.
export function getOverlayColors (themeConfig = {}) {
  const bg = parseHexColor(themeConfig['main-dark']) || [0, 0, 0]
  const fg = parseHexColor(themeConfig.text) || [221, 221, 221]
  return {
    color: '#' + bg.map(toHex).join(''),
    symbolColor: '#' + fg.map(toHex).join('')
  }
}

export default function TitleBarOverlay ({ themeConfig }) {
  const { color, symbolColor } = getOverlayColors(themeConfig)

  useEffect(() => {
    // setTitleBarOverlay throws if the overlay is off or the color does not
    // parse; neither can happen from here, but the rejection would otherwise
    // surface as an unhandled promise rejection
    window.pre.runGlobalAsync('setTitleBarOverlay', { color, symbolColor })
      .catch(() => {})
  }, [color, symbolColor])

  return null
}

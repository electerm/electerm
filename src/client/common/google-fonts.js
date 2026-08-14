import { createElement } from 'react'

// Curated monospace fonts self-hosted from Google Fonts (see
// css/includes/fonts.styl) for the per-bookmark terminal font picker.
export const googleFonts = [
  'IBM Plex Mono',
  'Fira Code',
  'JetBrains Mono',
  'Source Code Pro',
  'Roboto Mono',
  'Space Mono',
  'Ubuntu Mono',
  'Inconsolata',
  'Anonymous Pro',
  'Victor Mono',
  'VT323'
]

function fontOption (value, label) {
  return {
    value,
    label: createElement('span', { style: { fontFamily: label } }, label)
  }
}

// Google Fonts group + whatever fonts are installed on the current
// system (window.et.fonts, loaded async by Store.prototype.loadFontList).
// Read at render time rather than baked into a static field config so
// the system-fonts group reflects window.et.fonts once it's loaded.
export function buildFontFamilyOptions () {
  const groups = [
    {
      label: 'Google Fonts',
      options: googleFonts.map(f => fontOption(`${f}, monospace`, f))
    }
  ]
  const systemFonts = (window.et || {}).fonts || []
  if (systemFonts.length) {
    groups.push({
      label: 'System Fonts',
      options: systemFonts.map(f => fontOption(f, f))
    })
  }
  return groups
}

export default googleFonts

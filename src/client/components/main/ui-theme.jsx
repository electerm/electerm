/**
 * ui theme
 */

import { useEffect, useRef } from 'react'
import eq from 'fast-deep-equal'
import isColorDark from '../../common/is-color-dark'
import { terminalBgVar } from '../../common/terminal-background.mjs'

const themeDomId = 'theme-css'

function darker (color, amount = 0.1) {
  let usePound = false

  if (color[0] === '#') {
    color = color.slice(1)
    usePound = true
  }

  const num = parseInt(color, 16)

  let r = (num >> 16) - Math.round(255 * amount)
  if (r < 0) r = 0
  let b = ((num >> 8) & 0x00FF) - Math.round(255 * amount)
  if (b < 0) b = 0
  let g = (num & 0x0000FF) - Math.round(255 * amount)
  if (g < 0) g = 0

  return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16)
}

function buildTheme (themeConfig, terminalBackground) {
  const keys = Object.keys(themeConfig || {})
  const themeCss = keys.map(key => {
    const val = themeConfig[key]
    if (key === 'primary') {
      const contrast = isColorDark(val) ? '#fff' : '#000'
      return `--${key}-contrast: ${contrast};\n--${key}: ${val};`
    } else if (key === 'main') {
      const darkerMain = darker(val, 0.3)
      const lighterMain = darker(val, -0.3)
      return `--${key}-darker: ${darkerMain};\n--${key}-lighter: ${lighterMain};\n--${key}: ${val};`
    }
    return `--${key}: ${val};`
  }).join('\n')
  // the terminal area has its own background (theme key terminal:background),
  // which may deliberately differ from the UI main colour; theme.styl defaults
  // it to var(--main) so a theme without one keeps the previous look
  const terminalBg = terminalBackground || themeConfig.main
  const terminalCss = terminalBg ? `${terminalBgVar}: ${terminalBg};` : ''
  const css = `:root {\n${terminalCss}\n${themeCss}\n}\n`
  return Promise.resolve(css)
}

export default function UiTheme (props) {
  const { themeConfig, terminalBackground } = props

  const prevRef = useRef(null)

  async function applyTheme () {
    const style = document.getElementById(themeDomId)
    const css = await buildTheme(themeConfig, terminalBackground)
    style.innerHTML = css
  }

  useEffect(() => {
    applyTheme()
  }, [])

  useEffect(() => {
    const next = { themeConfig, terminalBackground }
    if (prevRef.current && !eq(prevRef.current, next)) {
      applyTheme()
    }
    prevRef.current = next
  }, [themeConfig, terminalBackground])

  return null
}

/**
 * ui theme
 */

import { useEffect, useRef } from 'react'
import eq from 'fast-deep-equal'
import isColorDark from '../../common/is-color-dark'

const themeDomId = 'theme-css'

function darker (color, amount = 0.1) {
  let usePound = false

  if (color[0] === '#') {
    color = color.slice(1)
    usePound = true
  }

  const num = parseInt(color, 16)
  // clamp both ends: no upper clamp produced illegal colors like
  // '#1393939' (8 chars) for lighten, missing padStart produced '#0'
  // for darken — either way every var(--main-darker/-lighter) consumer
  // died at computed-value time (see 美化设计规范 §3.9)
  const clamp = (v) => Math.min(255, Math.max(0, v))

  const r = clamp((num >> 16) - Math.round(255 * amount))
  const b = clamp(((num >> 8) & 0x00FF) - Math.round(255 * amount))
  const g = clamp((num & 0x0000FF) - Math.round(255 * amount))

  const hex = (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0')

  return (usePound ? '#' : '') + hex
}

function buildTheme (themeConfig) {
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
  if (themeCss) {
    const css = `:root {\n${themeCss}\n}\n`
    return Promise.resolve(css)
  }
  return Promise.resolve('')
}

export default function UiTheme (props) {
  const { themeConfig } = props

  const prevRef = useRef(null)

  async function applyTheme () {
    const style = document.getElementById(themeDomId)
    const css = await buildTheme(themeConfig)
    style.innerHTML = css
  }

  useEffect(() => {
    applyTheme()
  }, [])

  useEffect(() => {
    if (prevRef.current && !eq(prevRef.current, themeConfig)) {
      applyTheme()
    }
    prevRef.current = themeConfig
  }, [themeConfig])

  return null
}

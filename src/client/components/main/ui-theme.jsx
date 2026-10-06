/**
 * ui theme
 */

import { useEffect, useRef } from 'react'
import eq from 'fast-deep-equal'
import isColorDark from '../../common/is-color-dark'
import { darker } from '../../common/ui-theme-color.mjs'

const themeDomId = 'theme-css'

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

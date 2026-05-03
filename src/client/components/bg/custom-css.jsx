/**
 * ui theme
 */

import { useEffect } from 'react'

const themeDomId = 'custom-css'

export default function CustomCss (props) {
  const { customCss, configLoaded } = props

  useEffect(() => {
    if (configLoaded) {
      const style = document.getElementById(themeDomId)
      if (style) {
        const safeCss = (customCss || '').replace(/@import/gi, '#')
        style.innerHTML = safeCss
      }
    }
  }, [customCss, configLoaded])

  return null
}

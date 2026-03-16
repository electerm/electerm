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
        style.innerHTML = customCss || ''
      }
    }
  }, [customCss, configLoaded])

  return null
}

/**
 * ui theme
 */

import { useEffect, useRef } from 'react'
import eq from 'fast-deep-equal'

const themeDomId = 'custom-css'

export default function CustomCss (props) {
  const { customCss } = props
  const prevRef = useRef(null)

  async function applyTheme () {
    const style = document.getElementById(themeDomId)
    style.innerHTML = customCss
  }

  useEffect(() => {
    applyTheme()
  }, [])

  useEffect(() => {
    if (prevRef.current && !eq(prevRef.current, customCss)) {
      applyTheme()
    }
    prevRef.current = customCss
  }, [customCss])

  return null
}

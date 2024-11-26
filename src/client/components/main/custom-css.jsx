/**
 * ui theme
 */

import { useEffect } from 'react'
import { useDelta, useConditionalEffect } from 'react-delta-hooks'
import eq from 'fast-deep-equal'

const themeDomId = 'custom-css'

export default function CustomCss (props) {
  const { customCss } = props

  const delta = useDelta(customCss)

  async function applyTheme () {
    const stylus = document.getElementById(themeDomId)
    stylus.innerHTML = customCss
  }

  useEffect(() => {
    applyTheme()
  }, [])
  useConditionalEffect(() => {
    applyTheme()
  }, delta && !eq(delta.prev, delta.curr))
  return null
}

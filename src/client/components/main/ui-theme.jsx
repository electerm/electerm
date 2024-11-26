/**
 * ui theme
 */

import { useEffect } from 'react'
import { useDelta, useConditionalEffect } from 'react-delta-hooks'
import eq from 'fast-deep-equal'

const themeDomId = 'theme-css'

export default function UiTheme (props) {
  const { themeConfig, buildTheme } = props

  const delta = useDelta(themeConfig)

  async function applyTheme () {
    const stylus = document.getElementById(themeDomId)
    const {
      stylusCss
    } = await buildTheme(themeConfig)
    stylus.innerHTML = stylusCss
  }

  useEffect(() => {
    applyTheme()
  }, [])
  useConditionalEffect(() => {
    applyTheme()
  }, delta && delta.prev && !eq(delta.prev, delta.curr))
  return null
}

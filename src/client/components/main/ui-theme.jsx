/**
 * btns
 */

import { useEffect } from 'react'
import { useDelta, useConditionalEffect } from 'react-delta'
import eq from 'fast-deep-equal'

const themeDomId = 'theme-css'
const lessDomId = 'less-css'

export default function UiTheme (props) {
  const { themeConfig, buildTheme } = props

  const delta = useDelta((themeConfig))

  async function applyTheme () {
    const stylus = document.getElementById(themeDomId)
    const less = document.getElementById(lessDomId)
    const {
      stylusCss,
      lessCss
    } = await buildTheme(themeConfig)
    stylus.innerHTML = stylusCss
    less.innerHTML = lessCss
  }

  useEffect(() => {
    applyTheme()
  }, [])
  useConditionalEffect(() => {
    applyTheme()
  }, delta && delta.prev && !eq(delta.prev, delta.curr))
  return null
}

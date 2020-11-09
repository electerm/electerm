/**
 * btns
 */

import { useEffect } from 'react'
import { useDelta, useConditionalEffect } from 'react-delta'
import eq from 'fast-deep-equal'

const themeDomId = 'ui-theme'

export default function UiTheme (props) {
  const { themeConfig, buildTheme } = props
  const delta = useDelta((themeConfig))
  function configToLessConfig (conf) {
    return Object.keys(conf).reduce((p, k) => {
      return {
        ...p,
        ['@' + k]: conf[k]
      }
    }, {})
  }

  function updateLess () {
    window.less.modifyVars(configToLessConfig(themeConfig))
  }

  async function applyTheme () {
    const style = document.createElement('style')
    style.type = 'text/css'
    style.innerHTML = await buildTheme(themeConfig)
    style.id = themeDomId
    document.getElementsByTagName('head')[0].appendChild(style)
    updateLess()
  }

  async function updateTheme () {
    const style = document.getElementById(themeDomId)
    const css = await buildTheme(themeConfig)
    style.innerHTML = css
    updateLess()
  }
  useEffect(() => {
    applyTheme()
  }, [])
  useConditionalEffect(() => {
    updateTheme()
  }, delta && delta.prev && !eq(delta.prev, delta.curr))
  return null
}

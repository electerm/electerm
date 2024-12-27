/**
 * ui theme functions
 */

/**
 * theme related functions
 */

import { escapeRegExp, find } from 'lodash-es'
import {
  defaultTheme,
  settingMap
} from '../common/constants'
// import fetch from '../common/fetch'
import copy from 'json-deep-copy'

export default Store => {
  Store.prototype.getDefaultUiThemeConfig = function (stylus) {
    const reg = /[^\n]+ = [^\n]+\n/g
    const arr = stylus.match(reg)
    const sep = ' = '
    return arr.reduce((p, x) => {
      if (!x.includes(sep)) {
        return p
      }
      const [k, v] = x.split(sep)
      return {
        ...p,
        [k.trim()]: v.trim()
      }
    }, {})
  }

  Store.prototype.buildTheme = function (config) {
    let { stylus } = window.et
    const keys = Object.keys(config)
    for (const key of keys) {
      const reg = new RegExp(escapeRegExp(key) + ' = [^\\n]+\\n')
      const v = config[key]
      stylus = stylus.replace(reg, `${key} = ${v}\n`)
    }
    return window.pre.runGlobalAsync('toCss', stylus)
  }

  Store.prototype.sortTheme = function (a, b) {
    const { theme } = window.store.config
    const ax = a.id === theme ? -1 : 1
    const bx = b.id === theme ? -1 : 1
    return ax - bx
  }

  Store.prototype.getUiThemeConfig = function () {
    const { store } = window
    const theme = find(
      store.getSidebarList(settingMap.terminalThemes),
      d => d.id === store.config.theme
    )
    return theme && theme.uiThemeConfig
      ? copy(theme.uiThemeConfig)
      : defaultTheme.uiThemeConfig
  }
}

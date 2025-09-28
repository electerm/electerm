/**
 * ui theme functions
 */

import {
  defaultTheme,
  settingMap
} from '../common/constants'
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

  Store.prototype.getUiThemeConfig = function () {
    const { store } = window
    const theme = store.getSidebarList(settingMap.terminalThemes)
      .find(d => d.id === store.config.theme)
    return theme && theme.uiThemeConfig
      ? copy(theme.uiThemeConfig)
      : defaultTheme.uiThemeConfig
  }
}

/**
 * ui theme functions
 */

import {
  defaultTheme,
  settingMap
} from '../common/constants'
import copy from 'json-deep-copy'

export default Store => {
  Store.prototype.getUiThemeConfig = function () {
    const { store } = window
    const theme = store.getSidebarList(settingMap.terminalThemes)
      .find(d => d.id === store.config.theme)
    return theme && theme.uiThemeConfig
      ? copy(theme.uiThemeConfig)
      : defaultTheme.uiThemeConfig
  }
}

/**
 * ui theme functions
 */

/**
 * theme related functions
 */

import _ from 'lodash'
import {
  defaultTheme,
  settingMap
} from '../common/constants'
import fetch from '../common/fetch'
import copy from 'json-deep-copy'

function configToLessConfig (conf) {
  return Object.keys(conf).reduce((p, k) => {
    return {
      ...p,
      ['@' + k]: conf[k]
    }
  }, {})
}

export default Store => {
  Store.prototype.toCss = async function (stylus) {
    const { host, port } = window._config
    const url = `http://${host}:${port}/to-css`
    const data = await fetch.post(url, {
      stylus
    })
    return data
  }

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
      const reg = new RegExp(_.escapeRegExp(key) + ' = [^\\n]+\\n')
      const v = config[key]
      stylus = stylus.replace(reg, `${key} = ${v}\n`)
    }
    const lessConf = configToLessConfig(config)
    return window.pre.runGlobalAsync('toCss', stylus, lessConf)
  }

  Store.prototype.getUiThemeConfig = function () {
    const { store } = window
    const theme = _.find(
      store.getSidebarList(settingMap.terminalThemes),
      d => d.id === store.config.theme
    )
    return theme && theme.uiThemeConfig
      ? copy(theme.uiThemeConfig)
      : defaultTheme.uiThemeConfig
  }
}

/**
 * theme related functions
 */

import { message } from 'antd'
import { find, isEqual } from 'lodash-es'
import {
  defaultTheme,
  settingMap,
  defaultThemeLight
} from '../common/constants'
import copy from 'json-deep-copy'
import { convertTheme } from '../common/terminal-theme'

const e = window.translate

export default Store => {
  Store.prototype.getTerminalThemes = function () {
    return window.store.getItems(settingMap.terminalThemes)
  }

  Store.prototype.setTheme = function (id) {
    window.store.updateConfig({
      theme: id
    })
  }

  Store.prototype.addTheme = function (theme) {
    window.store.addItem(theme, settingMap.terminalThemes)
  }

  Store.prototype.editTheme = function (id, updates) {
    return window.store.editItem(
      id, updates, settingMap.terminalThemes
    )
  }

  Store.prototype.delTheme = function ({ id }) {
    window.store.delItem({ id }, settingMap.terminalThemes)
  }

  Store.prototype.getThemeConfig = function () {
    const { store } = window
    const all = store.getSidebarList(settingMap.terminalThemes)
    return (find(all, d => d.id === store.config.theme) || {}).themeConfig || {}
  }

  Store.prototype.fixThemes = function (themes) {
    return themes.map(t => {
      const isDefaultTheme = t.id === defaultTheme.id
      const isDefaultThemeLight = t.id === defaultThemeLight.id
      if (isDefaultTheme) {
        Object.assign(t, defaultTheme)
      } else if (isDefaultThemeLight) {
        Object.assign(t, defaultThemeLight)
      } else if (!t.uiThemeConfig) {
        t.uiThemeConfig = copy(defaultTheme.uiThemeConfig)
      }
      return t
    })
  }

  Store.prototype.setItermThemes = function (arr) {
    window.store.itermThemes = arr
  }

  Store.prototype.fetchItermThemes = async function () {
    const list = await window.pre.runGlobalAsync('listItermThemes')
    window.store.setItermThemes(
      list.map(d => {
        const obj = convertTheme(d)
        return {
          ...obj,
          id: 'iterm#' + obj.name,
          readonly: true,
          type: 'iterm'
        }
      })
    )
  }

  Store.prototype.checkDefaultTheme = async function (terminalThemes) {
    const { store } = window
    const themeId = defaultTheme.id
    const currentDefaultTheme = find(store.terminalThemes, d => d.id === themeId)
    if (
      currentDefaultTheme &&
      (
        !isEqual(currentDefaultTheme.themeConfig, defaultTheme.themeConfig) || !isEqual(currentDefaultTheme.uiThemeConfig, defaultTheme.uiThemeConfig) ||
        currentDefaultTheme.name !== defaultTheme.name
      )
    ) {
      store.editTheme(
        themeId,
        {
          name: defaultTheme.name,
          themeConfig: defaultTheme.themeConfig,
          uiThemeConfig: defaultTheme.uiThemeConfig
        }
      )
      message.info(
        `${e('default')} ${e('themeConfig')} ${e('updated')}`
      )
    }
    const hasLightTheme = find(store.getTerminalThemes(), d => d.id === defaultThemeLight.id)
    if (!hasLightTheme) {
      store.addTheme(defaultThemeLight)
    }
  }
}

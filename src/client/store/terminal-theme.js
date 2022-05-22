/**
 * theme related functions
 */

import { message } from 'antd'
import _ from 'lodash'
import {
  defaultTheme,
  settingMap,
  defaultThemeLight
} from '../common/constants'
import copy from 'json-deep-copy'
import { convertTheme } from '../common/terminal-theme'

const { terminalThemes } = settingMap
const { prefix } = window
const t = prefix(terminalThemes)

export default store => {
  Object.assign(store, {
    getTerminalThemes () {
      return store.getItems(settingMap.terminalThemes)
    },

    setTerminalThemes (arr) {
      return store.setItems(settingMap.terminalThemes, arr)
    },

    setTheme (id) {
      store.updateConfig({
        theme: id
      })
    },

    addTheme (theme) {
      store.addItem(theme, settingMap.terminalThemes)
    },

    editTheme (id, updates) {
      return store.editItem(
        id, updates, settingMap.terminalThemes
      )
    },

    delTheme ({ id }) {
      store.delItem({ id }, settingMap.terminalThemes)
    },

    getThemeConfig () {
      const all = store.getSidebarList(settingMap.terminalThemes)
      return (_.find(all, d => d.id === store.config.theme) || {}).themeConfig || {}
    },

    fixThemes (themes) {
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
    },

    setItermThemes (arr) {
      store.setItems('itermThemes', arr)
    },

    getItermThemes () {
      return store.getItems('itermThemes')
    },

    async fetchItermThemes () {
      const list = await window.pre.runGlobalAsync('listItermThemes')
      store.setItermThemes(
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
    },

    async checkDefaultTheme (terminalThemes) {
      const themeId = defaultTheme.id
      const currentDefaultTheme = _.find(store.terminalThemes, d => d.id === themeId)
      if (
        currentDefaultTheme &&
        (
          !_.isEqual(currentDefaultTheme.themeConfig, defaultTheme.themeConfig) || !_.isEqual(currentDefaultTheme.uiThemeConfig, defaultTheme.uiThemeConfig) ||
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
          `${t('default')} ${t('themeConfig')} ${t('updated')}`
        )
      }
      const hasLightTheme = _.find(store.getTerminalThemes(), d => d.id === defaultThemeLight.id)
      if (!hasLightTheme) {
        store.addTheme(defaultThemeLight)
      }
    }
  })
}

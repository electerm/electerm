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
import { insert, update, remove } from '../common/db'

const { terminalThemes } = settingMap
const { prefix } = window
const t = prefix(terminalThemes)

export default store => {
  Object.assign(store, {
    setTheme (id) {
      store.updateConfig({
        theme: id
      })
    },

    addTheme (theme) {
      store.terminalThemes.unshift(theme)
      insert(terminalThemes, theme)
    },

    editTheme (id, updates) {
      const items = store.terminalThemes
      const item = _.find(items, t => t.id === id)
      Object.assign(item, updates)
      update(id, updates, terminalThemes)
    },

    delTheme ({ id }) {
      store.terminalThemes = store.terminalThemes.filter(t => {
        return t.id !== id
      })
      const { theme } = store.config
      if (theme === id) {
        store.config.theme = defaultTheme.id
      }
      remove(terminalThemes, id)
    },
    // computed
    getThemeConfig () {
      return (_.find(store.terminalThemes, d => d.id === store.config.theme) || {}).themeConfig || {}
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
      const hasLightTheme = _.find(store.terminalThemes, d => d.id === defaultThemeLight.id)
      if (!hasLightTheme) {
        store.terminalThemes.push(defaultThemeLight)
      }
    }
  })
}

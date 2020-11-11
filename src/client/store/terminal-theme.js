/**
 * theme related functions
 */

import { message } from 'antd'
import _ from 'lodash'
import {
  defaultTheme,
  settingMap
} from '../common/constants'
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

    async checkDefaultTheme () {
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
    }
  })
}

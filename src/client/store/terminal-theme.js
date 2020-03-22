/**
 * theme related functions
 */

import { message } from 'antd'
import _ from 'lodash'
import {
  defaultTheme,
  settingMap
} from '../common/constants'
import { insert, update, remove, findOne } from '../common/db'

const { terminalThemes } = settingMap
const { prefix } = window
const t = prefix(terminalThemes)

export default store => {
  Object.assign(store, {
    setTheme (id) {
      store.config.theme = id
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
      const { config } = store
      const themeId = config.theme || defaultTheme.id
      const currentTheme = await findOne(
        terminalThemes,
        themeId
      ) || defaultTheme
      if (
        currentTheme.id === defaultTheme.id &&
        !_.isEqual(currentTheme.themeConfig, defaultTheme.themeConfig)
      ) {
        store.editTheme(
          defaultTheme.id,
          {
            themeConfig: defaultTheme.themeConfig
          }
        )
        message.info(
          `${t('default')} ${t('themeConfig')} ${t('updated')}`
        )
      }
    }
  })
}

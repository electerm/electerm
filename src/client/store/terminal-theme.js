/**
 * theme related functions
 */

import { message } from 'antd'
import _ from 'lodash'
import {
  defaultTheme,
  settingMap
} from '../common/constants'
import { dbAction } from '../common/db'

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
      const { id, ...update } = theme
      dbAction(terminalThemes, 'insert', {
        _id: id,
        ...update
      })
    },

    editTheme (id, update) {
      const items = store.terminalThemes
      const item = _.find(items, t => t.id === id)
      Object.assign(item, update)
      dbAction(terminalThemes, 'update', {
        _id: id
      }, update)
    },

    delTheme ({ id }) {
      store.terminalThemes = store.terminalThemes.filter(t => {
        return t.id !== id
      })
      const { theme } = store.config
      if (theme === id) {
        store.config.theme = defaultTheme.id
      }
    },
    // computed
    getThemeConfig () {
      return (_.find(store.terminalThemes, d => d.id === store.config.theme) || {}).themeConfig || {}
    },

    async checkDefaultTheme () {
      const { config } = store
      const themeId = config.theme || defaultTheme.id
      const currentTheme = await dbAction(
        terminalThemes,
        'findOne',
        {
          _id: themeId
        }
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

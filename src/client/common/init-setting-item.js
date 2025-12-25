/**
 * get init setting item
 */

import {
  settingMap,
  newBookmarkIdPrefix,
  settingCommonId
} from './constants'
import { buildNewTheme } from '../common/terminal-theme'

const e = window.translate
const newQuickCommand = 'newQuickCommand'

export default (arr, tab) => {
  if (tab === settingMap.history) {
    return arr[0] || {}
  } else if (tab === settingMap.bookmarks) {
    return { id: newBookmarkIdPrefix + ':' + (Date.now()), title: '' }
  } else if (tab === settingMap.setting) {
    return { id: settingCommonId, title: e('common') }
  } else if (tab === settingMap.terminalThemes) {
    return buildNewTheme()
  } else if (tab === settingMap.quickCommands) {
    return {
      id: '',
      name: e(newQuickCommand)
    }
  } else if (tab === settingMap.profiles) {
    return {
      id: '',
      name: e(settingMap.profiles)
    }
  } else if (tab === settingMap.widgets) {
    return {
      id: '',
      name: e(settingMap.widgets)
    }
  } else if (tab === settingMap.workspaces) {
    return {
      id: '',
      name: e(settingMap.workspaces),
      layout: 'default',
      tabsByBatch: {}
    }
  }
}

/**
 * get init setting item
 */

import {
  settingMap,
  newBookmarkIdPrefix,
  settingCommonId
} from './constants'
import { buildNewTheme } from '../common/terminal-theme'

const { prefix } = window
const e = prefix('control')
const newQuickCommand = 'newQuickCommand'
const q = prefix('quickCommands')

export default (arr, tab) => {
  if (tab === settingMap.history) {
    return arr[0] || {}
  } else if (tab === settingMap.bookmarks) {
    return { id: newBookmarkIdPrefix + ':' + (+new Date()), title: '' }
  } else if (tab === settingMap.setting) {
    return { id: settingCommonId, title: e('common') }
  } else if (tab === settingMap.terminalThemes) {
    return buildNewTheme()
  } else if (tab === settingMap.quickCommands) {
    return {
      id: '',
      name: q(newQuickCommand)
    }
  }
}

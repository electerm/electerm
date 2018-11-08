/* eslint-disable */
/**
 * state management
 */

import Subx from 'subx'
import newTerm from '../common/new-terminal'
import copy from 'json-deep-copy'
import {
  maxHistory,
  settingMap,
  defaultookmarkGroupId,
  maxTransferHistory,
  statusMap
} from '../../common/constants'

const {getGlobal, _config} = window
const ls = getGlobal('ls')
const {prefix} = window
const t = prefix('terminalThemes')

let tabs = [newTerm()]
let bookmarks = copy(ls.get(settingMap.bookmarks) || [])

let getDefaultBookmarkGroups = (bookmarks) => {
  return [
    {
      title: t(defaultookmarkGroupId),
      id: defaultookmarkGroupId,
      bookmarkIds: bookmarks.map(d => d.id)
    }
  ]
}

const store = Subx.create({
  tabs,
  height: 500,
  width: window.innerWidth,
  currentTabId: tabs[0].id,
  bookmarkGroups: copy(
    ls.get(settingMap.bookmarkGroups) ||
    this.getDefaultBookmarkGroups(bookmarks)
  ),
  isMaximized: window.getGlobal('isMaximized')(),
  config: copy(_config) || {},
  contextMenuProps: {},
  transferHistory: [],
  themes: terminalThemes.getThemes(),
  theme: terminalThemes.getCurrentTheme().id,
  showControl: true,
  contextMenuVisible: false,
  fileInfoModalProps: {},
  fileModeModalProps: {},
  currentBookmarkGroupId: defaultookmarkGroupId,
  shouldCheckUpdate: 0,
  transferHistoryModalVisible: false,
  onCheckUpdating: false,
  selectedSessions: [],
  sessionModalVisible: false,
  textEditorProps: {}
})

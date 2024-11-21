/**
 * output default new terminal data obj
 */

import uid from './id-with-stamp'
import {
  paneMap
} from './constants'

const e = window.translate
window.et.tabCount = 0

export function updateCount (tab) {
  tab.tabCount = window.et.tabCount
  window.et.tabCount++
}

export default (removeTitle, noUpdateCount) => {
  const res = {
    id: uid(),
    status: 'processing',
    pane: paneMap.terminal,
    title: e('newTerminal')
  }
  if (removeTitle) {
    delete res.title
  }
  if (!noUpdateCount) {
    updateCount(res)
  }
  return res
}

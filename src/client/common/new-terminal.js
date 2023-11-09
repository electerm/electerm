/**
 * output default new terminal data obj
 */

import generate from './uid'
import {
  paneMap
} from './constants'

const { prefix } = window
const e = prefix('control')
window.et.tabCount = 0

export function updateCount (tab) {
  tab.tabCount = window.et.tabCount
  window.et.tabCount++
}

export default (removeTitle, noUpdateCount) => {
  const res = {
    id: generate(),
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

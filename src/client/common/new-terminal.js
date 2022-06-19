/**
 * output default new terminal data obj
 */

import generate from './uid'
import {
  paneMap
} from './constants'

const { prefix } = window
const e = prefix('control')
window.et.tabIndex = 1

export default (len) => {
  let i = 0
  if (len) {
    i = window.et.tabIndex
    window.et.tabIndex = window.et.tabIndex + 1
  }
  const res = {
    id: generate(),
    status: 'processing',
    pane: paneMap.terminal,
    title: e('newTerminal') + (len ? `(${i})` : '')
  }
  if (len === false) {
    delete res.title
  }
  return res
}

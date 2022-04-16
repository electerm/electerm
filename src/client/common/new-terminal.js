/**
 * output default new terminal data obj
 */

import generate from './uid'
import {
  paneMap
} from './constants'

const { prefix } = window
const e = prefix('control')

export default (len) => ({
  id: generate(),
  status: 'processing',
  pane: paneMap.terminal,
  title: e('newTerminal') + (len ? `(${len})` : '')
})

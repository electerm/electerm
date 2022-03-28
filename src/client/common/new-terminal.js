/**
 * output default new terminal data obj
 */

import generate from './uid'

const { prefix } = window
const e = prefix('control')

export default (len) => ({
  id: generate(),
  status: 'processing',
  title: e('newTerminal') + (len ? `(${len})` : '')
})

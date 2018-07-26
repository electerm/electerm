/**
 * output default new terminal data obj
 */

import {generate} from 'shortid'

const {prefix} = window
const e = prefix('control')

export default () => ({
  id: generate(),
  status: defaultStatus,
  title: e('newTerminal')
})

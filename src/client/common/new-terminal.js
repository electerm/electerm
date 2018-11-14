/**
 * output default new terminal data obj
 */

import {generate} from 'shortid'
import {statusMap} from './constants'
const {prefix} = window
const e = prefix('control')

export default () => ({
  id: generate(),
  status: statusMap.processing,
  title: e('newTerminal')
})

/**
 * output default new terminal data obj
 */

import { generate } from 'shortid'
import { statusMap } from './constants'

const { prefix } = window
const e = prefix('control')
const defaultStatus = statusMap.processing

export default () => ({
  id: generate(),
  status: defaultStatus,
  title: e('newTerminal')
})

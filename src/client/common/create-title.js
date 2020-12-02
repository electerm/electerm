/**
 * tab title create rule
 */

import {
  terminalLocalType
} from './constants'

const { prefix } = window
const p = prefix('sftp')

export default (res = {}) => {
  const {
    host, port, username, title, type,
    path
  } = res
  const fixTitle = `${username}@${host}:${port}`
  const extra = host || path ? (path || fixTitle) : ''
  let f = title
    ? `${title}` + (extra ? ` - ${extra}` : '')
    : extra
  if (type) {
    f = `[${type}]${f}`
  }
  return f || p(terminalLocalType)
}

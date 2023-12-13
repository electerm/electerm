/**
 * tab title create rule
 */

import {
  terminalLocalType
} from './constants'

const { prefix } = window
const p = prefix('sftp')

export default (res) => {
  if (!res) {
    return ''
  }
  const {
    host, port, username, title, type,
    path, connectionHoppings
  } = res
  const fixTitle = `${username || ''}@${host}:${port}`
  const extra = host || path ? (path || fixTitle) : ''
  let f = title
    ? `${title}` + (extra ? ` - ${extra}` : '')
    : extra
  if (connectionHoppings && connectionHoppings.length) {
    f = `[⋙]${f}`
  }
  if (type) {
    f = `[${type}]${f}`
  }
  return f || p(terminalLocalType)
}

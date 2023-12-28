/**
 * tab title create rule
 */

import {
  terminalLocalType
} from './constants'

const { prefix } = window
const p = prefix('sftp')

export default function createTitle (res) {
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

export function createTitleTag (obj) {
  const { color } = obj
  if (!color) {
    return null
  }
  const styleTag = color
    ? { color }
    : {}
  return (
    <span style={styleTag}>♦</span>
  )
}

export function createTitleWithTag (obj) {
  return (
    <span className='tab-title'>
      {createTitleTag(obj)} {createTitle(obj)}
    </span>
  )
}

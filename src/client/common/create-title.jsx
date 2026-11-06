/**
 * tab title create rule
 */

import {
  terminalLocalType
} from './constants'
import ItemIcon from '../components/common/item-icon.jsx'

const e = window.translate

function maskHost (hostOrIp = '') {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostOrIp)) {
    const arr = hostOrIp.split('.')
    return arr.slice(0, arr.length - 2).join('.') + '.*.*'
  } else {
    return hostOrIp.replace(/^.{3}/, '***')
  }
}

export default function createTitle (res, hide = true) {
  if (!res) {
    return ''
  }
  const {
    host, port, username, title, type, url,
    path, connectionHoppings, sshTunnels
  } = res
  const h = hide && window.store.config.hideIP ? maskHost(host) : host
  const fixTitle = `${username || ''}@${h}:${port}`
  const extra = host || path ? (path || fixTitle) : (url || '')
  // onlyShowTitleInTab: a session that was given its own title shows just that
  // title. One without a title is left alone and keeps the host/user fallback,
  // otherwise the tab would read as empty.
  const onlyTitle = title && window.store.config.onlyShowTitleInTab
  let f = title
    ? `${title}` + (extra && !onlyTitle ? ` - ${extra}` : '')
    : extra
  if (connectionHoppings && connectionHoppings.length) {
    f = `[⋙]${f}`
  }
  if (
    sshTunnels &&
    sshTunnels.length &&
    sshTunnels[0].sshTunnel &&
    sshTunnels[0].sshTunnelRemoteHost
  ) {
    f = `[T]${f}`
  }
  if (res.mcpStatus) {
    f = `[${res.mcpStatus}]${f}`
  }
  if (res.from === 'mcp') {
    f = `[mcp]${f}`
  }
  if (type && type !== 'ssh') {
    f = `[${type}]${f}`
  }
  return f || e(terminalLocalType)
}

/**
 * Icon (or colour) shown before the name of a bookmark, a bookmark group or a
 * tab. The icon wins when the item has one.
 * @param {{color?: string, icon?: string}} obj
 */
export function createTitleTag (obj) {
  const { color, icon } = obj
  if (!color && !icon) {
    return null
  }
  const styleTag = color
    ? { color }
    : {}
  return (
    <span className='tab-title-tag'>
      <ItemIcon
        icon={icon}
        color={color}
        size={13}
        fallback={<span style={styleTag}>●</span>}
      />
    </span>
  )
}

export function createTitleWithTag (obj) {
  return (
    <span className='tab-title'>
      {createTitleTag(obj)} {createTitle(obj)}
    </span>
  )
}

/**
 * tab title create rule
 */

import {
  terminalLocalType
} from './constants'

const { prefix } = window
const p = prefix('sftp')

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
    host, port, username, title, type,
    path, connectionHoppings, sshTunnels
  } = res
  const h = hide && window.store.config.hideIP ? maskHost(host) : host
  const fixTitle = `${username || ''}@${h}:${port}`
  const extra = host || path ? (path || fixTitle) : ''
  let f = title
    ? `${title}` + (extra ? ` - ${extra}` : '')
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
    ? { color, marginRight: '5px', fontSize: '16px' } // 增加间距、增大图标
    : {}
  return (
    <span style={styleTag}>●</span>
  )
}

export function createTitleWithTag (obj) {
  return (
    <span className='tab-title'>
      {createTitleTag(obj)} {createTitle(obj)}
    </span>
  )
}

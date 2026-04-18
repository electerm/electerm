/**
 * tab title create rule
 */

import {
  terminalLocalType
} from './constants'

const e = window.translate

function maskHost (hostOrIp = '') {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostOrIp)) {
    const arr = hostOrIp.split('.')
    return arr.slice(0, arr.length - 2).join('.') + '.*.*'
  } else {
    return hostOrIp.replace(/^.{3}/, '***')
  }
}

function getDefaultTemplate () {
  return '{typePrefix}{tunnel}{hopping}{title}{title? - }{extra}'
}

function parseTemplate (template, data) {
  const {
    host,
    port,
    username,
    title,
    type,
    url,
    path,
    connectionHoppings,
    sshTunnels,
    hideIP
  } = data

  const h = hideIP ? maskHost(host) : host
  const hostPort = `${username || ''}@${h}:${port}`
  const extra = host || path ? (path || hostPort) : (url || '')

  // Build type prefix
  const typePrefix = (type && type !== 'ssh') ? `[${type}]` : ''

  // Build hopping prefix
  const hopping = connectionHoppings && connectionHoppings.length ? '[⋙]' : ''

  // Build tunnel prefix
  const tunnel = sshTunnels &&
    sshTunnels.length &&
    sshTunnels[0].sshTunnel &&
    sshTunnels[0].sshTunnelRemoteHost
    ? '[T]'
    : ''

  // Replace placeholders
  const result = template
    .replace(/{typePrefix}/g, typePrefix)
    .replace(/{tunnel}/g, tunnel)
    .replace(/{hopping}/g, hopping)
    .replace(/{title}/g, title || '')
    .replace(/{title\? - }/g, title ? ' - ' : '')
    .replace(/{extra}/g, extra)
    .replace(/{username}/g, username || '')
    .replace(/{host}/g, h || '')
    .replace(/{port}/g, port || '')
    .replace(/{type}/g, type || '')
    .replace(/{url}/g, url || '')
    .replace(/{path}/g, path || '')

  return result || e(terminalLocalType)
}

export default function createTitle (res, hide = true) {
  if (!res) {
    return ''
  }
  const template = window.store.config.tabTitleTemplate || getDefaultTemplate()

  const data = {
    ...res,
    hideIP: hide && window.store.config.hideIP
  }

  return parseTemplate(template, data)
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
    <span style={styleTag} className='tab-title-tag'>●</span>
  )
}

export function createTitleWithTag (obj) {
  return (
    <span className='tab-title'>
      {createTitleTag(obj)} {createTitle(obj)}
    </span>
  )
}

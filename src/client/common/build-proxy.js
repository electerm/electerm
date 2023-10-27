export const buildProxyString = function (obj) {
  if (!obj.proxyIp) {
    return ''
  }

  const proxyTypeMapping = {
    5: 'socks5',
    4: 'socks4',
    0: 'http',
    1: 'https'
  }

  const proxyType = proxyTypeMapping[obj.proxyType] || ''
  const hasCredentials = obj.proxyUsername && obj.proxyPassword
  const credentials = hasCredentials ? `${obj.proxyUsername}:${obj.proxyPassword}@` : ''

  return `${proxyType}://${credentials}${obj.proxyIp}${obj.proxyPort ? `:${obj.proxyPort}` : ''}`
}

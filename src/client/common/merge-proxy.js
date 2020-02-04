/**
 * check if tab proxy setting valid
 */

import _ from 'lodash'

const isValidProxy = (proxy) => {
  return proxy &&
    proxy.proxyIp &&
    proxy.proxyPort
}

export function mergeProxy (globalConfig, tab) {
  const { proxy } = tab
  if (isValidProxy(proxy)) {
    return proxy
  }
  return globalConfig.enableGlobalProxy
    ? _.pick(globalConfig, [
      'proxyPort',
      'proxyIp',
      'proxyType',
      'proxyPassword',
      'proxyUsername'
    ])
    : {}
}

// common proxy agent creator
exports.createProxyAgent = (url = '') => {
  if (
    typeof url !== 'string' ||
    (!url.startsWith('http') && !url.startsWith('socks'))
  ) {
    return
  }
  const Cls = url.startsWith('http')
    ? require('https-proxy-agent').HttpsProxyAgent
    : require('socks-proxy-agent').SocksProxyAgent
  return new Cls(url, {
    keepAlive: true
  })
}

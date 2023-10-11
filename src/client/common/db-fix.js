// make old data imported compatible
import { buildProxyString } from '../../app/lib/build-proxy.js'
import { buildSshTunnels } from '../../app/common/build-ssh-tunnel.js'
import { buildRunScripts } from '../../app/common/build-run-scripts.js'

export function fixBookmarks (arr) {
  return arr.map(bookmark => {
    if (typeof bookmark.proxy !== 'string') {
      bookmark.proxy = buildProxyString(bookmark.proxy || {})
    }
    if (bookmark.sshTunnel) {
      bookmark.sshTunnels = buildSshTunnels(bookmark.sshTunnel)
      delete bookmark.sshTunnel
      delete bookmark.sshTunnelRemotePort
      delete bookmark.sshTunnelLocalPort
    }
    if (bookmark.loginScript) {
      bookmark.runScripts = buildRunScripts(bookmark)
      delete bookmark.loginScript
      delete bookmark.loginScriptDelay
    }
    return bookmark
  })
}

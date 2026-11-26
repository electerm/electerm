function endpoint (host, port) {
  const address = String(host ?? '127.0.0.1') || '*'
  return (address.includes(':') ? '[' + address + ']' : address) + ':' + (port ?? '')
}

export default function formatSshTunnel (tunnel) {
  const e = window.translate
  const local = endpoint(tunnel.sshTunnelLocalHost, tunnel.sshTunnelLocalPort)
  const remote = endpoint(tunnel.sshTunnelRemoteHost, tunnel.sshTunnelRemotePort)
  switch (tunnel.sshTunnel) {
    case 'dynamicForward': return e('local') + ' socks5://' + local
    case 'remoteDynamicForward': return e('remote') + ' socks5://' + remote
    case 'forwardRemoteToLocal': return e('remote') + ' ' + remote + ' → ' + e('local') + ' ' + local
    case 'forwardLocalToRemote': return e('local') + ' ' + local + ' → ' + e('remote') + ' ' + remote
    default: return tunnel.sshTunnel
  }
}

// Only these two states have a translation in electerm-locales. The transient
// ones get an icon in the panel and are left out of text-only places such as the
// tab tooltip, and a failed tunnel already shows the server message itself.
export function sshTunnelStatusText (status) {
  return status === 'running' || status === 'stopped'
    ? window.translate(status)
    : ''
}

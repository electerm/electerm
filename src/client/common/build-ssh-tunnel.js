export const buildSshTunnels = function (inst) {
  return [{
    sshTunnel: inst.sshTunnel,
    sshTunnelRemotePort: inst.sshTunnelRemotePort,
    sshTunnelLocalPort: inst.sshTunnelLocalPort
  }]
}

const forwards = require('./ssh-tunnel')
const uid = require('../common/uid')

// Imported bookmarks can contain numeric strings and omit the loopback hosts.
// Validate before passing a port to net.listen (which also accepts pipe paths).
function tunnelOptions (definition) {
  const type = definition?.sshTunnel
  if (!Object.hasOwn(forwards, type)) {
    throw new Error('Unknown SSH tunnel type')
  }
  const options = { sshTunnel: type }
  for (const side of ['Local', 'Remote']) {
    if ((side === 'Remote' && type === 'dynamicForward') ||
        (side === 'Local' && type === 'remoteDynamicForward')) continue
    const portKey = 'sshTunnel' + side + 'Port'
    const hostKey = 'sshTunnel' + side + 'Host'
    const rawPort = definition[portKey]
    const port = typeof rawPort === 'string' && /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(side + ' port must be between 1 and 65535')
    }
    const host = definition[hostKey] ?? '127.0.0.1'
    if (typeof host !== 'string') throw new Error('Invalid ' + side.toLowerCase() + ' host')
    options[portKey] = port
    options[hostKey] = host
  }
  return options
}

class SshTunnelManager {
  constructor (conn) {
    this.conn = conn
    this.entries = new Map()
    conn.once('close', () => {
      this.conn = null
      this.entries.clear()
    })
  }

  list () {
    return Array.from(this.entries.values(), ({ stop, ...result }) => result)
  }

  async add (sshTunnel, temporary) {
    if (!this.conn) throw new Error('SSH session disconnected')
    const entry = { id: uid(), sshTunnel, temporary, status: 'stopped' }
    this.entries.set(entry.id, entry)
    await this.change('start', entry.id)
  }

  async change (command, id) {
    const entry = this.entries.get(id)
    if (!entry) throw new Error('Tunnel no longer exists')
    if (entry.status === 'starting' || entry.status === 'stopping') {
      throw new Error('Tunnel operation in progress')
    }
    if (command === 'start' && !entry.stop) {
      delete entry.error
      entry.status = 'starting'
      try {
        const options = tunnelOptions(entry.sshTunnel)
        entry.stop = await forwards[options.sshTunnel]({ ...options, conn: this.conn })
        entry.status = 'running'
      } catch (err) {
        entry.status = 'error'
        entry.error = err.message
      }
    } else if (command === 'stop' && entry.stop) {
      delete entry.error
      entry.status = 'stopping'
      try {
        await entry.stop()
        delete entry.stop
        entry.status = 'stopped'
      } catch (err) {
        // The SSH server can refuse to cancel a remote listener. Keep its handle for retry.
        entry.status = 'running'
        entry.error = err.message
      }
    }
  }
}

module.exports = { SshTunnelManager }

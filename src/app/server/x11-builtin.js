const { randomBytes, timingSafeEqual } = require('crypto')
const { createWebSocketStream } = require('ws')

const protocol = Buffer.from('MIT-MAGIC-COOKIE-1')
const setupLength = 48 // 12-byte header, 18-byte name padded to 20, 16-byte cookie

class BuiltinDisplay {
  constructor () {
    this.secret = randomBytes(16)
    this.clients = new Map()
  }

  get cookie () {
    return this.secret.toString('hex')
  }

  accept (accept, reject) {
    if (this.closed || this.clients.size >= 32) return reject()
    const stream = accept()
    const id = randomBytes(16).toString('hex')
    const client = { stream, ready: false }
    this.clients.set(id, client)
    // Bound both setup reads and authenticated channels waiting for a viewer.
    client.timer = setTimeout(() => stream.destroy(), 30000)
    const cleanup = () => {
      clearTimeout(client.timer)
      this.clients.delete(id)
      client.viewer?.destroy()
    }
    stream.once('close', cleanup)
    stream.once('end', cleanup)
    stream.on('error', () => stream.destroy())
    const readSetup = () => {
      const setup = stream.read(setupLength)
      if (!setup) return
      stream.removeListener('readable', readSetup)
      if (setup.length !== setupLength || setup[0] !== 0x6c ||
          setup.readUInt16LE(2) !== 11 || setup.readUInt16LE(6) !== protocol.length ||
          setup.readUInt16LE(8) !== 16 || !setup.subarray(12, 30).equals(protocol) ||
          !timingSafeEqual(setup.subarray(32), this.secret)) {
        stream.destroy()
        return
      }
      client.ready = true
      this.announce(id, client)
    }
    stream.on('readable', readSetup)
  }

  announce (id, client) {
    if (client.ready && !client.viewer && this.terminal?.readyState === 1) {
      this.terminal.s({ action: 'x11-client', id })
    }
  }

  onTerminalReady (ws) {
    this.terminal = ws
    for (const [id, client] of this.clients) this.announce(id, client)
  }

  attach (id, ws) {
    const client = this.clients.get(id)
    if (!client?.ready || client.viewer) return false
    clearTimeout(client.timer)
    const viewer = createWebSocketStream(ws)
    client.viewer = viewer
    viewer.on('error', () => client.stream.destroy())
    viewer.once('close', () => client.stream.destroy())
    // Authentication ended at the SSH boundary. Send a fresh setup without
    // the session secret and preserve every request buffered after it.
    viewer.write(Buffer.from([108, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
    client.stream.pipe(viewer).pipe(client.stream)
    return true
  }

  close () {
    this.closed = true
    for (const { stream, viewer, timer } of this.clients.values()) {
      clearTimeout(timer)
      stream.destroy()
      viewer?.destroy()
    }
    this.clients.clear()
    this.terminal = null
    this.secret.fill(0)
  }
}

module.exports = { BuiltinDisplay }

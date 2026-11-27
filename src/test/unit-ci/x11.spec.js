const { describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const { setImmediate: nextTurn } = require('node:timers/promises')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const {
  getX11Candidates,
  enableX11Forwarding,
  probeXServer,
  x11Hint,
  x11CookieHint
} = require('../../../src/app/server/x11')

describe('x11 helpers', () => {
  test('linux: unix socket first, then tcp, from empty DISPLAY', () => {
    assert.deepEqual(
      getX11Candidates('', 'linux'),
      [
        { path: '/tmp/.X11-unix/X0' },
        { port: 6000, host: '127.0.0.1' }
      ]
    )
  })

  test('linux: honour the display number, keep :0 as fallback', () => {
    assert.deepEqual(
      getX11Candidates(':1', 'linux'),
      [
        { path: '/tmp/.X11-unix/X1' },
        { port: 6001, host: '127.0.0.1' },
        { path: '/tmp/.X11-unix/X0' },
        { port: 6000, host: '127.0.0.1' }
      ]
    )
  })

  test('linux: host prefixed display with screen number', () => {
    assert.deepEqual(
      getX11Candidates('localhost:10.0', 'linux'),
      [
        { path: '/tmp/.X11-unix/X10' },
        { port: 6010, host: '127.0.0.1' },
        { path: '/tmp/.X11-unix/X0' },
        { port: 6000, host: '127.0.0.1' }
      ]
    )
  })

  test('macOS XQuartz: DISPLAY is already a socket path', () => {
    assert.deepEqual(
      getX11Candidates('/private/tmp/com.apple.launchd.abc/org.xquartz:0', 'darwin'),
      [{ path: '/private/tmp/com.apple.launchd.abc/org.xquartz:0' }]
    )
  })

  test('windows: tcp only, no unix socket', () => {
    assert.deepEqual(
      getX11Candidates(':0', 'win32'),
      [{ port: 6000, host: '127.0.0.1' }]
    )
  })

  test('a display beyond the TCP port range retains its available fallbacks', () => {
    assert.equal(getX11Candidates(':59535', 'win32')[0].port, 65535)
    const defaultTcp = { port: 6000, host: '127.0.0.1' }
    assert.deepEqual(getX11Candidates(':59536', 'win32'), [defaultTcp])
    assert.deepEqual(getX11Candidates(':59536', 'linux'), [
      { path: '/tmp/.X11-unix/X59536' }, { path: '/tmp/.X11-unix/X0' }, defaultTcp
    ])
  })

  test('probeXServer: false when nothing listens', async () => {
    const r = await probeXServer(
      [{ path: path.join(os.tmpdir(), 'electerm-no-x-server-here') }],
      300
    )
    assert.equal(r, false)
  })

  test('probeXServer: true when an endpoint accepts', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-x11-'))
    const sockPath = process.platform === 'win32'
      ? `\\\\.\\pipe\\${path.basename(dir)}`
      : path.join(dir, 'X0')
    const server = net.createServer()
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject).listen(sockPath, resolve)
      })
      const r = await probeXServer([{ path: sockPath }], 500)
      assert.equal(r, true)
    } finally {
      if (server.listening) await new Promise(resolve => server.close(resolve))
      fs.rmdirSync(dir)
    }
  })

  test('probeXServer: stops at the first reachable endpoint', async () => {
    const server = net.createServer()
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    try {
      const r = await probeXServer([
        { path: '/tmp/.X11-unix/does-not-exist' },
        { port, host: '127.0.0.1' },
        { port: 1, host: '127.0.0.1' }
      ], 500)
      assert.equal(r, true)
    } finally {
      server.close()
    }
  })

  test('hints are platform specific', () => {
    assert.match(x11Hint('darwin'), /XQuartz/)
    assert.match(x11Hint('win32'), /VcXsrv/)
    assert.match(x11Hint('linux'), /X server/)
    assert.match(x11CookieHint('darwin'), /\/opt\/X11\/bin/)
    assert.match(x11CookieHint('linux'), /xauth list/)
  })
})

describe('X11 channel forwarding', () => {
  function setupForwarding (t, display = '/configured/x11/socket') {
    const attempts = []
    t.mock.method(net, 'connect', endpoint => {
      const socket = new net.Socket()
      attempts.push({ socket, endpoint })
      return socket
    })
    const conn = new EventEmitter()
    const send = t.mock.fn()
    const session = { display, initOptions: { srcTabId: 'tab' }, ws: { s: send } }
    enableX11Forwarding(session, conn)
    function open () {
      const remote = new PassThrough()
      const accept = t.mock.fn(() => remote)
      const reject = t.mock.fn()
      conn.emit('x11', {}, accept, reject)
      return { remote, accept, reject, socket: attempts.at(-1).socket }
    }
    return { display, conn, attempts, send, open }
  }

  function openChannel (t, display) {
    const forwarding = setupForwarding(t, display)
    return { ...forwarding, ...forwarding.open() }
  }

  test('connects to the configured display first and accepts the channel only once', async t => {
    const { display, attempts, remote, accept, reject } = openChannel(t)
    assert.deepEqual(attempts[0].endpoint, { path: display })
    const { socket } = attempts[0]
    socket.emit('connect')
    assert.equal(accept.mock.callCount(), 1)
    socket.destroy(new Error('X server disconnected'))
    await nextTurn()
    assert.equal(remote.destroyed, true)
    assert.equal(attempts.length, 1)
    assert.equal(accept.mock.callCount(), 1)
    assert.equal(reject.mock.callCount(), 0)
  })

  test('rejects the remote channel and warns the tab when all local displays refuse it', async t => {
    const { attempts, accept, reject, send } = openChannel(t, ':3')
    const tried = new Set()
    for (let i = 0; i < attempts.length; i++) {
      assert.ok(i < 500, 'local display retries must be bounded')
      const { endpoint, socket } = attempts[i]
      const address = endpoint.path ?? endpoint.port
      assert.ok(!tried.has(address), `endpoint ${address} was already tried`)
      tried.add(address)
      socket.destroy(new Error('Connection refused'))
      await nextTurn()
    }
    assert.equal(accept.mock.callCount(), 0)
    assert.equal(reject.mock.callCount(), 1)
    assert.equal(send.mock.callCount(), 1)
    assert.equal(send.mock.calls[0].arguments[0].action, 'x11-warning')
    assert.equal(send.mock.calls[0].arguments[0].tabId, 'tab')
  })

  test('closing SSH cancels a pending display connection', async t => {
    const { conn, attempts, accept } = openChannel(t)
    const { socket } = attempts[0]
    conn.emit('close')
    await nextTurn()
    assert.equal(socket.destroyed, true)
    socket.emit('connect')
    assert.equal(accept.mock.callCount(), 0)
    assert.equal(attempts.length, 1)
  })

  test('closing SSH tears down both sides of an accepted X11 channel', async t => {
    const { conn, attempts, accept, remote } = openChannel(t)
    const { socket } = attempts[0]
    socket.emit('connect')
    conn.emit('close')
    await nextTurn()
    assert.equal(socket.destroyed, true)
    assert.equal(remote.destroyed, true)
    assert.equal(accept.mock.callCount(), 1)
    assert.equal(attempts.length, 1)
  })

  test('concurrent open and pending channels share one SSH close listener', async t => {
    const { open, conn, attempts } = setupForwarding(t)
    const channels = Array.from({ length: 20 }, () => open())
    assert.equal(conn.listenerCount('close'), 1)
    for (const { socket } of channels.slice(0, 10)) socket.emit('connect')

    // One finished independently, and another is between display candidates.
    channels[0].remote.destroy()
    channels[10].socket.destroy(new Error('Connection refused'))
    await nextTurn()
    const finished = t.mock.method(channels[0].socket, 'destroy')
    assert.equal(attempts.length, 21)
    assert.equal(conn.listenerCount('close'), 1)

    conn.emit('close')
    conn.emit('close')
    await nextTurn()
    assert.equal(finished.mock.callCount(), 0)
    assert.equal(conn.listenerCount('close'), 0)
    assert.equal(conn.listenerCount('x11'), 0)
    for (const { socket } of attempts) {
      assert.equal(socket.destroyed, true)
      socket.emit('connect')
    }
    for (const [i, { remote, accept, reject }] of channels.entries()) {
      assert.equal(remote.destroyed, i < 10)
      assert.equal(accept.mock.callCount(), i < 10 ? 1 : 0)
      assert.equal(reject.mock.callCount(), 0)
    }
    assert.equal(attempts.length, 21)
  })
})

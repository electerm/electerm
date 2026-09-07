const { describe, test } = require('node:test')
const assert = require('node:assert/strict')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const {
  getX11Candidates,
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

  test('probeXServer: false when nothing listens', async () => {
    const r = await probeXServer(
      [{ path: path.join(os.tmpdir(), 'electerm-no-x-server-here') }],
      300
    )
    assert.equal(r, false)
  })

  test('probeXServer: true when an endpoint accepts', async () => {
    const sockPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-x11-')),
      'X0'
    )
    const server = net.createServer()
    await new Promise((resolve) => server.listen(sockPath, resolve))
    try {
      const r = await probeXServer([{ path: sockPath }], 500)
      assert.equal(r, true)
    } finally {
      server.close()
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

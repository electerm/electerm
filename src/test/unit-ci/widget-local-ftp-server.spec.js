/**
 * The built-in FTP server used to bind 0.0.0.0 with the shipped
 * ftpuser/ftppass credentials and $HOME as its root. These tests pin the
 * hardened defaults and make sure saved instances with the old password
 * cannot be started after an upgrade.
 */

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const net = require('net')
const os = require('os')
const path = require('path')

const { widgetInfo, widgetRun } = require('../../app/widgets/widget-local-ftp-server')

function defaultOf (name) {
  return widgetInfo.configs.find(config => config.name === name).default
}

function freePort () {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function makeWidget (config = {}) {
  return widgetRun({
    host: '127.0.0.1',
    port: 0,
    directory: os.tmpdir(),
    ...config
  }, { log: () => {}, event: () => {} })
}

test('defaults are loopback-only, non-home and without a shipped password', () => {
  assert.equal(defaultOf('host'), '127.0.0.1')
  assert.equal(defaultOf('directory'), path.join(os.homedir(), 'electerm-ftp-share'))
  assert.equal(defaultOf('anonymous'), false)
  assert.equal(defaultOf('password'), '')
})

test('refuses to start without a password', async () => {
  const widget = makeWidget()
  await assert.rejects(() => widget.start(), /Set an FTP password/)
})

test('refuses the old shipped password even in saved instances', async () => {
  const widget = makeWidget({ password: 'ftppass' })
  await assert.rejects(() => widget.start(), /shipped default FTP password/)
})

test('refuses anonymous access rooted at the home directory', async () => {
  const widget = makeWidget({ anonymous: true, directory: os.homedir() })
  await assert.rejects(() => widget.start(), /Anonymous FTP cannot use the home directory/)
})

test('a generated password works, creates the share dir and stays out of status text', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ftp-hardened-'))
  const directory = path.join(base, 'share')
  const password = 'ett_a1b2c3d4e5f6'
  const port = await freePort()
  const widget = makeWidget({ port, directory, password })
  try {
    const result = await widget.start()
    assert.ok(fs.statSync(directory).isDirectory())
    assert.equal(result.serverInfo.path, directory)
    assert.equal(result.serverInfo.url, `ftp://ftpuser:${password}@127.0.0.1:${port}`)
    assert.doesNotMatch(result.msg, /ett_/)
    assert.doesNotMatch(result.msg, new RegExp(password))
  } finally {
    await widget.stop()
    fs.rmSync(base, { recursive: true, force: true })
  }
})

process.env.NODE_ENV = 'development'

const { describe, test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
const { Server, utils } = require('@electerm/ssh2')
const {
  session
} = require('../../../src/app/server/session-ssh')
const {
  expandProxyCommand,
  isNetbirdLikeHost
} = require('../../../src/app/server/ssh-proxy-command')

const USERNAME = 'tester'
const PASSWORD = 'electerm-test'

const HOST_KEY = utils.generateKeyPairSync('ed25519', {
  comment: 'electerm-test-host'
})

function makeTmpDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-proxy-cmd-test-'))
}

// in-process ssh server the fake netbird proxy forwards to
async function startServer () {
  const clients = new Set()
  const server = new Server({
    hostKeys: [HOST_KEY.private]
  }, (client) => {
    clients.add(client)
    const cleanup = () => clients.delete(client)
    client.on('close', cleanup)
    client.on('end', cleanup)
    client.on('authentication', (ctx) => {
      if (ctx.method === 'password' && ctx.username === USERNAME && ctx.password === PASSWORD) {
        return ctx.accept()
      }
      return ctx.reject(['password'])
    })
    client.on('ready', () => {
      client.on('session', (accept) => {
        const sshSession = accept()
        sshSession.on('env', (accept) => accept())
        sshSession.on('pty', (accept) => accept())
        sshSession.on('shell', (accept) => {
          const stream = accept()
          stream.write('electerm proxy-command ready\n')
        })
      })
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    port: server.address().port,
    async close () {
      for (const client of clients) {
        client.end()
      }
      await new Promise((resolve, reject) => {
        server.close((err) => err ? reject(err) : resolve())
      })
    }
  }
}

/**
 * write a fake `netbird` executable:
 * - `netbird ssh detect host port` exits 0/2 per FAKE_DETECT_EXIT
 * - `netbird ssh proxy host port` bridges its stdio to the local test server
 */
function writeFakeNetbird (dir, targetPort, detectExit = 0) {
  const script = `#!/usr/bin/env node
const net = require('net')
const args = process.argv.slice(2)
if (args[0] === 'ssh' && args[1] === 'detect') {
  process.exit(${detectExit})
}
if (args[0] === 'ssh' && args[1] === 'proxy') {
  process.stderr.write('SSH authentication required.\\n')
  process.stderr.write('Please do the SSO login in your browser.\\n')
  process.stderr.write('https://example.netbird.io/device-auth/abc123\\n')
  const sock = net.connect(${targetPort}, '127.0.0.1')
  sock.on('connect', () => {
    process.stdin.pipe(sock)
    sock.pipe(process.stdout)
  })
  sock.on('error', (e) => {
    process.stderr.write('proxy error: ' + e.message + '\\n')
    process.exit(1)
  })
  process.stdin.on('end', () => sock.end())
  process.stdin.resume()
  return
}
process.exit(2)
`
  const p = path.join(dir, 'netbird')
  fs.writeFileSync(p, script, { mode: 0o755 })
  return p
}

function createPromptWs () {
  return {
    messages: [],
    s (payload) {
      this.messages.push(payload)
    },
    once (handler) {
      queueMicrotask(() => handler({ results: [] }))
    },
    close () {}
  }
}

describe('expandProxyCommand', () => {
  test('expands %h %p %r placeholders', () => {
    assert.deepEqual(
      expandProxyCommand('netbird ssh proxy %h %p', { host: '100.99.0.1', port: 22, username: 'root' }),
      ['netbird', 'ssh', 'proxy', '100.99.0.1', '22']
    )
    assert.deepEqual(
      expandProxyCommand('cloudflared access ssh --hostname %h --port %p --username %r', {
        host: 'a.example.com', port: 2222, username: 'bob'
      }),
      ['cloudflared', 'access', 'ssh', '--hostname', 'a.example.com', '--port', '2222', '--username', 'bob']
    )
    assert.deepEqual(
      expandProxyCommand('  fixed   command  ', { host: 'x', port: 1, username: '' }),
      ['fixed', 'command']
    )
  })
})

describe('isNetbirdLikeHost', () => {
  test('matches netbird CGNAT range only', () => {
    assert.equal(isNetbirdLikeHost('100.64.0.1'), true)
    assert.equal(isNetbirdLikeHost('100.127.255.254'), true)
    assert.equal(isNetbirdLikeHost('100.63.255.255'), false)
    assert.equal(isNetbirdLikeHost('100.128.0.1'), false)
    assert.equal(isNetbirdLikeHost('101.1.1.1'), false)
    assert.equal(isNetbirdLikeHost('192.168.1.1'), false)
    assert.equal(isNetbirdLikeHost('peer.example.com'), false)
    assert.equal(isNetbirdLikeHost(''), false)
    assert.equal(isNetbirdLikeHost(undefined), false)
  })
})

describe('ssh proxy command', () => {
  let tmpDir
  let server
  let netbirdPath
  let origBin

  beforeEach(async () => {
    tmpDir = makeTmpDir()
    server = await startServer()
    netbirdPath = writeFakeNetbird(tmpDir, server.port, 0)
    origBin = process.env.ELECTERM_NETBIRD_BIN
    process.env.ELECTERM_NETBIRD_BIN = netbirdPath
    // reset module level detect cache between tests
    const mod = require('../../../src/app/server/ssh-proxy-command')
    mod.clearDetectCache()
  })

  afterEach(async () => {
    if (origBin === undefined) {
      delete process.env.ELECTERM_NETBIRD_BIN
    } else {
      process.env.ELECTERM_NETBIRD_BIN = origBin
    }
    await server.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('connects through netbird ssh proxy for netbird-like host', async () => {
    const ws = createPromptWs()
    let term
    try {
      term = await session({
        host: '100.99.0.1',
        port: 22,
        username: USERNAME,
        password: PASSWORD,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 10000
      }, ws)
      assert.ok(term, 'session should connect through proxy command')
      // no host key confirm prompt should appear: proxied connection skips verification
      const confirms = ws.messages.filter(m => m.action === 'session-interactive')
      assert.equal(confirms.length, 0)
      // SSO url from proxy stderr surfaced once
      const notes = ws.messages.filter(m => m.action === 'ssh-proxy-command-message')
      assert.equal(notes.length, 1)
      assert.ok(notes[0].url.includes('example.netbird.io'))
    } finally {
      term && term.kill()
    }
  })

  test('returns null when detect exits non-zero (non-netbird server)', async () => {
    // point at a detect-only stub: detect exits 2 ("regular ssh server"),
    // any proxy invocation exits 1 - so a non-null result would fail loudly
    const stub = path.join(tmpDir, 'netbird-detect-only')
    fs.writeFileSync(
      stub,
      '#!/usr/bin/env node\n' +
      'const args = process.argv.slice(2)\n' +
      "if (args[0] === 'ssh' && args[1] === 'detect') { process.exit(2) }\n" +
      'process.exit(1)\n',
      { mode: 0o755 }
    )
    process.env.ELECTERM_NETBIRD_BIN = stub
    const mod = require('../../../src/app/server/ssh-proxy-command')
    mod.clearDetectCache()
    const r = await mod.maybeProxyCommand(
      { host: '100.99.0.2', port: 22 },
      { host: '100.99.0.2', port: 22 },
      {}
    )
    assert.equal(r, null)
  })

  test('non-netbird host skips detection entirely', async () => {
    // stub fails on every invocation; a null result proves it was never called
    const stub = path.join(tmpDir, 'netbird-fail-all')
    fs.writeFileSync(stub, '#!/usr/bin/env node\nprocess.exit(1)\n', { mode: 0o755 })
    process.env.ELECTERM_NETBIRD_BIN = stub
    const mod = require('../../../src/app/server/ssh-proxy-command')
    mod.clearDetectCache()
    const r = await mod.maybeProxyCommand(
      { host: '192.168.1.10', port: 22 },
      { host: '192.168.1.10', port: 22 },
      {}
    )
    assert.equal(r, null)
  })

  test('explicit proxyCommand option connects through it', async () => {
    const ws = createPromptWs()
    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        password: PASSWORD,
        useSshAgent: false,
        enableSsh: false,
        proxyCommand: `${netbirdPath} ssh proxy 127.0.0.1 ${server.port}`,
        readyTimeout: 10000
      }, ws)
      assert.ok(term)
      const notes = ws.messages.filter(m => m.action === 'ssh-proxy-command-message')
      assert.equal(notes.length, 1)
    } finally {
      term && term.kill()
    }
  })
})

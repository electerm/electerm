process.env.NODE_ENV = 'development'

const { describe, test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { once } = require('node:events')
const { Server, utils } = require('@electerm/ssh2')
const {
  session
} = require('../../../src/app/server/session-ssh')
const {
  expandProxyCommand,
  isNetbirdLikeHost,
  maybeProxyCommand,
  clearDetectCache
} = require('../../../src/app/server/ssh-proxy-command')
const { createProxyFixture } = require('../integration/lib/ssh-proxy-fixture')

const USERNAME = 'tester'
const PASSWORD = 'electerm-test'

const HOST_KEY = utils.generateKeyPairSync('ed25519', {
  comment: 'electerm-test-host'
})

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
    // killing the proxy command child (see session-ssh kill()) resets its
    // socket to this in-process server instead of closing it cleanly, and an
    // unhandled socket error here would crash the whole run
    client.on('error', () => {})
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

// Production spawns BIN with "ssh detect host port" or "ssh proxy host port".
// With Node as BIN, its first operand is a script named "ssh" in the test's
// private working directory. No shell or platform-specific launcher is needed.
function writeFakeNetbird (targetPort, detectExit = 0) {
  fs.writeFileSync('ssh', `
const net = require('net')
const fs = require('fs')
const args = process.argv.slice(2)
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n')
if (args[0] === 'detect') {
  process.exit(${detectExit})
}
if (args[0] === 'proxy') {
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
  return
}
process.exit(2)
`)
}

function netbirdCalls () {
  if (!fs.existsSync('calls.jsonl')) return []
  return fs.readFileSync('calls.jsonl', 'utf8').trim().split('\n').map(line => JSON.parse(line))
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
  let previousCwd
  let fixture
  let server
  let node
  let origBin

  beforeEach(async () => {
    previousCwd = process.cwd()
    origBin = process.env.ELECTERM_NETBIRD_BIN
    fixture = createProxyFixture()
    node = path.relative(fixture.dir, fixture.node)
    process.chdir(fixture.dir)
    process.env.ELECTERM_NETBIRD_BIN = process.execPath
    clearDetectCache()
    server = await startServer()
    writeFakeNetbird(server.port)
  })

  afterEach(async () => {
    if (origBin === undefined) {
      delete process.env.ELECTERM_NETBIRD_BIN
    } else {
      process.env.ELECTERM_NETBIRD_BIN = origBin
    }
    process.chdir(previousCwd)
    try {
      await server?.close()
    } finally {
      fixture.dispose()
    }
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
      assert.deepEqual(netbirdCalls(), [
        ['detect', '100.99.0.1', '22'],
        ['proxy', '100.99.0.1', '22']
      ])
    } finally {
      term && term.kill()
    }
  })

  test('returns null when detect exits non-zero (non-netbird server)', async () => {
    writeFakeNetbird(server.port, 2)
    const r = await maybeProxyCommand(
      { host: '100.99.0.2', port: 22 },
      { host: '100.99.0.2', port: 22 },
      {}
    )
    assert.equal(r, null)
    assert.deepEqual(netbirdCalls(), [['detect', '100.99.0.2', '22']])
  })

  test('non-netbird host skips detection entirely', async () => {
    const r = await maybeProxyCommand(
      { host: '192.168.1.10', port: 22 },
      { host: '192.168.1.10', port: 22 },
      {}
    )
    assert.equal(r, null)
    assert.deepEqual(netbirdCalls(), [])
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
        proxyCommand: `${node} ssh proxy %h %p`,
        readyTimeout: 10000
      }, ws)
      assert.ok(term)
      const notes = ws.messages.filter(m => m.action === 'ssh-proxy-command-message')
      assert.equal(notes.length, 1)
      assert.deepEqual(netbirdCalls(), [['proxy', '127.0.0.1', String(server.port)]])
    } finally {
      term && term.kill()
    }
  })
})

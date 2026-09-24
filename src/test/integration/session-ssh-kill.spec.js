/**
 * Integration tests for TerminalSsh lifecycle: closing a tab must actually
 * close the ssh connection.
 *
 * Regression: kill() nulled this.conn / this.conns / this.nextConn *before*
 * calling doKill(), and doKill() only ends what it can still see — so the
 * transport was never closed. The remote side kept the session (and anything
 * riding on the connection: jumps hosts, ssh tunnels) alive after the user
 * closed the tab.
 *
 * Also covers the proxy command child process, which rode on the same
 * mistake: kill() cleared proxyCommandDispose before doKill() could call it,
 * so every closed tab left a `netbird ssh proxy` process behind.
 *
 * Run: node --test src/test/integration/session-ssh-kill.spec.js
 */

process.env.NODE_ENV = 'development'

const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')

// Required FIRST: ssh2-alg patches crypto.createDiffieHellman(Group), and ssh2
// captures those function references when its protocol modules load.
require('../../app/server/ssh2-alg')
const { session } = require('../../app/server/session-ssh')
const globalState = require('../../app/server/global-state')

const {
  startTestSshServer,
  stopTestSshServer,
  TEST_USERNAME,
  TEST_PASSWORD
} = require('./lib/ssh-test-server')
const { createTrustingWs, waitFor } = require('./lib/ssh-session-harness')

// keep the developer's ~/.ssh/known_hosts out of it
process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ssh-kill-'))

const KILL_PORT = 22240

function connect (initOptions = {}) {
  return session({
    host: '127.0.0.1',
    port: KILL_PORT,
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    useSshAgent: false,
    enableSsh: false,
    readyTimeout: 10000,
    cols: 80,
    rows: 24,
    ...initOptions
  }, createTrustingWs())
}

const liveClients = (server) => server._clients.size

/**
 * A stand-in for `netbird ssh proxy ...`: bridges its stdio to the test ssh
 * server and records its pid, so a test can tell whether the process was
 * reaped or left behind.
 */
function writeStubProxy () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ssh-kill-proxy-'))
  const pidFile = path.join(dir, 'proxy.pid')
  const bin = path.join(dir, 'stub-proxy')
  fs.writeFileSync(bin, `#!/usr/bin/env node
const fs = require('fs')
const net = require('net')
fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid))
const sock = net.connect(${KILL_PORT}, '127.0.0.1')
sock.on('connect', () => {
  process.stdin.pipe(sock)
  sock.pipe(process.stdout)
})
sock.on('error', () => process.exit(1))
process.stdin.on('end', () => sock.end())
process.stdin.resume()
`, { mode: 0o755 })
  return { bin, pidFile }
}

function isAlive (pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (_) {
    return false
  }
}

describe('session-ssh kill() releases the connection', () => {
  let server

  before(async () => {
    server = await startTestSshServer({ port: KILL_PORT })
  })

  after(async () => {
    await stopTestSshServer(server)
  })

  test('kill() closes the ssh transport', async () => {
    const term = await connect()
    const conn = term.conn
    assert.ok(conn, 'session should hold a connected client')
    assert.equal(liveClients(server), 1, 'server should have the client')

    // ssh-tunnel.js and friends hang their cleanup off conn 'close' — if the
    // transport is never closed, those listeners never fire either
    let connClosed = false
    conn.on('close', () => {
      connClosed = true
    })

    term.kill()

    // local side: the socket is no longer writable straight away
    assert.equal(conn._sock.writable, false, 'socket should stop being writable')
    // remote side: the server observes the disconnect (it drops the client
    // from its set on 'close'), i.e. the session really is gone
    await waitFor(() => liveClients(server) === 0)
    assert.equal(liveClients(server), 0, 'remote side still holds the connection')
    await waitFor(() => connClosed)
    assert.ok(connClosed, 'conn should emit close so tunnel cleanup runs')

    assert.equal(term.conn, null)
  })

  test('kill() ends jump-host hops and a half-open jump client too', async () => {
    const term = await connect()
    const ended = []
    const fake = (name) => ({ end: () => ended.push(name) })
    // jumping pushes every hop into conns and keeps the in-flight jump client
    // in nextConn; when a hop fails mid-handshake the two differ
    term.conns = [fake('hop-1'), fake('hop-2')]
    term.nextConn = fake('jump-in-flight')

    term.kill()

    assert.deepEqual(ended, ['hop-1', 'hop-2', 'jump-in-flight'])
    assert.equal(term.conns, null)
    assert.equal(term.nextConn, null)
    await waitFor(() => liveClients(server) === 0)
  })

  test('kill() unregisters the session and is safe to call twice', async () => {
    const term = await connect()
    const { pid } = term
    assert.equal(globalState.getSession(pid), term)

    term.kill()

    assert.equal(globalState.getSession(pid), undefined)
    assert.doesNotThrow(() => term.kill())
  })

  test('kill() reaps the proxy command child process', async () => {
    const { bin, pidFile } = writeStubProxy()
    const term = await connect({ proxyCommand: bin })
    await waitFor(() => fs.existsSync(pidFile))
    const childPid = Number(fs.readFileSync(pidFile, 'utf8'))
    assert.ok(isAlive(childPid), 'stub proxy should be running')
    try {
      term.kill()
      // kill() used to null proxyCommandDispose before doing anything with it,
      // so doKill() skipped the dispose and every closed tab left a stray
      // `netbird ssh proxy` process behind
      await waitFor(() => !isAlive(childPid), 5000)
      assert.ok(!isAlive(childPid), 'proxy command child was left running')
    } finally {
      if (isAlive(childPid)) {
        process.kill(childPid, 'SIGKILL')
      }
    }
  })
})

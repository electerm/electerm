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
const { session, test: testConnection } = require('../../app/server/session-ssh')
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
process.env.USERPROFILE = process.env.HOME

let server

function connectionOptions (overrides) {
  return {
    host: '127.0.0.1',
    port: server.address().port,
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    useSshAgent: false,
    enableSsh: false,
    readyTimeout: 10000,
    cols: 80,
    rows: 24,
    ...overrides
  }
}

function connect (options) {
  return session(connectionOptions(options), createTrustingWs())
}

const liveClients = (server) => server._clients.size

/**
 * A stand-in for `netbird ssh proxy ...`: bridges its stdio to the test ssh
 * server and records its pid, so a test can tell whether the process was
 * reaped or left behind.
 */
function writeStubProxy (t) {
  const dir = fs.mkdtempSync(path.join(process.env.HOME, 'proxy-'))
  const pidFile = path.join(dir, 'proxy.pid')
  const script = path.join(dir, 'proxy.js')
  fs.writeFileSync(script, `
const fs = require('fs')
const net = require('net')
fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid))
const sock = net.connect(${server.address().port}, '127.0.0.1')
sock.on('connect', () => {
  process.stdin.pipe(sock)
  sock.pipe(process.stdout)
})
sock.on('error', () => process.exit(1))
process.stdin.on('end', () => sock.end())
`)
  // Use Node directly on Windows too. Passing the temporary script path in
  // the environment also works when the user's temp directory contains spaces.
  process.env.ELECTERM_TEST_PROXY_SCRIPT = script
  const childPid = () => Number(fs.readFileSync(pidFile, 'utf8'))
  t.after(() => {
    if (fs.existsSync(pidFile) && isAlive(childPid())) process.kill(childPid(), 'SIGKILL')
    delete process.env.ELECTERM_TEST_PROXY_SCRIPT
  })
  return { proxyCommand: 'node -e require(process.env.ELECTERM_TEST_PROXY_SCRIPT)', childPid }
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
  before(async () => {
    server = await startTestSshServer({ port: 0 })
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

  test('kill() reaps the proxy command child process', async t => {
    const { proxyCommand, childPid } = writeStubProxy(t)
    const term = await connect({ proxyCommand })
    const pid = childPid()
    assert.ok(isAlive(pid), 'stub proxy should be running')
    term.kill()
    await waitFor(() => !isAlive(pid))
    await waitFor(() => liveClients(server) === 0)
  })

  test('a successful connection test releases the proxy and the SSH transport', async t => {
    const { proxyCommand, childPid } = writeStubProxy(t)
    const options = connectionOptions({ uid: 'probe-only', proxyCommand })
    assert.equal(await testConnection(options, createTrustingWs()), true)
    assert.equal(globalState.getSession(options.uid), undefined)
    const pid = childPid()
    await waitFor(() => !isAlive(pid))
    await waitFor(() => liveClients(server) === 0)
  })

  test('a failed connection test leaves the live session with the same uid usable', async t => {
    const term = await connect({ uid: 'shared-session-id' })
    t.after(() => term.kill())
    const options = connectionOptions({ uid: term.pid, password: 'incorrect' })
    assert.equal(await testConnection(options, createTrustingWs()), false)
    assert.equal(globalState.getSession(term.pid), term)
    await waitFor(() => liveClients(server) === 1)
    const result = await term.execCommand('echo still-connected')
    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout.trim(), 'still-connected')
  })
})

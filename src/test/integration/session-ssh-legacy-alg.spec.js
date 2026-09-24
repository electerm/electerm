/**
 * Integration tests for legacy / old-device SSH servers: legacy kex
 * (diffie-hellman-group1-sha1, diffie-hellman-group14-sha1 and
 * diffie-hellman-group-exchange-sha1), CBC ciphers, hmac-sha1/md5 and
 * ssh-rsa host keys — the crypto old routers, switches and embedded boxes
 * still speak.
 *
 * Two layers:
 *   1. in-process @electerm/ssh2 servers pinned to one algorithm set each
 *      (no external dependency, always runs)
 *   2. the real-OpenSSH docker rig in temp/dockers/legacy-ssh, which covers
 *      what the ssh2 server cannot serve (ssh2 has no group-exchange server
 *      side) and a full "old device" sshd_config. Self-skips without docker.
 *
 * Setup for layer 2:
 *   cd temp/dockers/legacy-ssh && docker build -t electerm-legacy-ssh .
 *   docker run -d --name electerm-legacy-ssh -p 2201:2201 -p 2202:2202 \
 *     -p 2203:2203 -p 2204:2204 electerm-legacy-ssh
 *
 * Run: node --test src/test/integration/session-ssh-legacy-alg.spec.js
 */

process.env.NODE_ENV = 'development'

const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { execSync } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const net = require('node:net')

// Required FIRST: ssh2-alg patches crypto.createDiffieHellman(Group) for the
// DH groups, and ssh2 captures those function references when its protocol
// modules load. Loading ssh2 before ssh2-alg would test a different setup than
// the app runs.
const { algDefault, algAlt } = require('../../app/server/ssh2-alg')
const { session } = require('../../app/server/session-ssh')
const { Client } = require('@electerm/ssh2')
const {
  SUPPORTED_KEX,
  SUPPORTED_SERVER_HOST_KEY,
  SUPPORTED_CIPHER,
  SUPPORTED_MAC,
  SUPPORTED_COMPRESSION
} = require('@electerm/ssh2/lib/protocol/constants.js')

const {
  startTestSshServer,
  stopTestSshServer,
  TEST_USERNAME,
  TEST_PASSWORD
} = require('./lib/ssh-test-server')
const { createTrustingWs } = require('./lib/ssh-session-harness')

// The app writes trusted host keys to ~/.ssh/known_hosts — point HOME at a
// throwaway dir so a test run never touches the developer's real file
const REAL_HOME = process.env.HOME
process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-legacy-alg-'))

// the docker CLI resolves its context from $HOME, so it must keep the real one
function docker (command, options = {}) {
  return execSync(`docker ${command}`, {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, HOME: REAL_HOME },
    ...options
  })
}

const IN_PROCESS_PORT = 22230
const RIG_DIR = path.resolve(__dirname, '../../../temp/dockers/legacy-ssh')
const RIG_IMAGE = 'electerm-legacy-ssh'
const RIG_CONTAINER = 'electerm-legacy-ssh'
const RIG_GROUP1 = 2201
const RIG_GROUP14 = 2202
const RIG_GEX = 2203
const RIG_OLD_DEVICE = 2204
// credentials created by temp/dockers/legacy-ssh/Dockerfile
const RIG_USER = 'tester'
const RIG_PASSWORD = 'tester'
const READY_TIMEOUT = 30000

// ─────────────────────────────────────────────────────────────────────────────
// session() harness
// ─────────────────────────────────────────────────────────────────────────────

// createTrustingWs() answers the host-key confirmation with "trust" — the
// throwaway HOME has an empty known_hosts, so every test server is unknown.

function connect (port, options = {}) {
  const {
    username = TEST_USERNAME,
    password = TEST_PASSWORD,
    enableSsh = false,
    initOptions = {}
  } = options
  return session({
    host: '127.0.0.1',
    port,
    username,
    password,
    useSshAgent: false,
    enableSsh,
    readyTimeout: 10000,
    cols: 80,
    rows: 24,
    ...initOptions
  }, createTrustingWs())
}

/**
 * The negotiated algorithm set lives in ssh2 internals (there is no public
 * API for it); `_kex.negotiated` is what ssh2's own handshake code fills in.
 */
function negotiated (termOrConn) {
  const conn = termOrConn && termOrConn.conn ? termOrConn.conn : termOrConn
  return (conn && conn._protocol && conn._protocol._kex
    ? conn._protocol._kex.negotiated
    : undefined) || {}
}

function connectRig (port, options = {}) {
  return connect(port, {
    username: RIG_USER,
    password: RIG_PASSWORD,
    ...options
  })
}

/**
 * Write a command to the session and resolve with everything the shell sent
 * back once `pattern` shows up (or with a timeout).
 * @param {object} term
 * @param {RegExp} pattern
 * @param {string} command
 * @param {number} timeout
 * @returns {Promise<string>}
 */
function waitForData (term, pattern, command, timeout = 8000) {
  return new Promise((resolve) => {
    let buf = ''
    term.on('data', (d) => {
      buf += d.toString()
      if (pattern.test(buf)) {
        resolve(buf)
      }
    })
    setTimeout(() => resolve(buf), timeout)
    term.write(`${command}\n`)
  })
}

function closeSession (term) {
  term.kill()
}

// ─────────────────────────────────────────────────────────────────────────────
// layer 1 — in-process ssh2 server, pinned algorithm sets
// ─────────────────────────────────────────────────────────────────────────────

describe('legacy ssh algorithms — in-process server', () => {
  let server

  before(async () => {
    server = await startTestSshServer({ port: IN_PROCESS_PORT })
  })

  after(async () => {
    await stopTestSshServer(server)
  })

  async function startPinned (algorithms) {
    await stopTestSshServer(server)
    server = await startTestSshServer({
      port: IN_PROCESS_PORT,
      algorithms
    })
  }

  test('every algorithm list only contains names this ssh2 build implements', () => {
    // regression: algAlt() used to list blowfish-cbc/arcfour, which the ssh2
    // fork dropped, so the legacy retry threw "Unsupported algorithm:
    // blowfish-cbc" before the handshake even started
    const lists = [
      ['kex', algDefault().kex, SUPPORTED_KEX],
      ['hmac', algDefault().hmac, SUPPORTED_MAC],
      ['compress', algDefault().compress, SUPPORTED_COMPRESSION],
      ['cipher', algAlt().cipher, SUPPORTED_CIPHER],
      ['serverHostKey', algAlt().serverHostKey, SUPPORTED_SERVER_HOST_KEY]
    ]
    for (const [name, list, supported] of lists) {
      const unsupported = list.filter(a => !supported.includes(a))
      assert.deepEqual(
        unsupported, [],
        `${name} list contains algorithm(s) ssh2 rejects: ${unsupported}`
      )
    }
    assert.ok(algDefault().kex.includes('diffie-hellman-group1-sha1'))
    assert.ok(algDefault().kex.includes('diffie-hellman-group14-sha1'))
    assert.ok(algDefault().kex.includes('diffie-hellman-group-exchange-sha1'))
  })

  test('the fixture really is pinned: a modern-only client cannot negotiate', async () => {
    // control test — proves the assertions below are not vacuous
    await startPinned({ kex: ['diffie-hellman-group1-sha1'] })
    const err = await new Promise((resolve) => {
      const conn = new Client()
      const timer = setTimeout(() => {
        conn.end()
        resolve(new Error('client timed out'))
      }, 8000)
      conn.on('ready', () => {
        clearTimeout(timer)
        conn.end()
        resolve(new Error('unexpectedly connected'))
      })
      conn.on('error', (e) => {
        clearTimeout(timer)
        resolve(e)
      })
      // ssh2's own default list: no sha1 kex at all
      conn.connect({
        host: '127.0.0.1',
        port: IN_PROCESS_PORT,
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        readyTimeout: 8000,
        keepaliveInterval: 0,
        algorithms: { kex: algDefault().kex.filter(k => !k.endsWith('-sha1')) }
      })
    })
    assert.match(err.message, /no matching key exchange algorithm/)
  })

  test('connects to a server offering only diffie-hellman-group1-sha1', async () => {
    await startPinned({
      kex: ['diffie-hellman-group1-sha1'],
      cipher: ['aes128-ctr'],
      hmac: ['hmac-sha2-256']
    })
    const term = await connect(IN_PROCESS_PORT)
    try {
      assert.equal(negotiated(term).kex, 'diffie-hellman-group1-sha1')
    } finally {
      closeSession(term)
    }
  })

  test('connects to a server offering only diffie-hellman-group14-sha1', async () => {
    await startPinned({
      kex: ['diffie-hellman-group14-sha1'],
      cipher: ['aes128-ctr'],
      hmac: ['hmac-sha2-256']
    })
    const term = await connect(IN_PROCESS_PORT)
    try {
      assert.equal(negotiated(term).kex, 'diffie-hellman-group14-sha1')
    } finally {
      closeSession(term)
    }
  })

  test('falls back to CBC/hmac-sha1 for an old device (algAlt retry)', async () => {
    // aes128-cbc/hmac-sha1 are only in algAlt(), never in algDefault(), so a
    // successful connect proves reTryAltAlg() ran and the alt list is usable
    await startPinned({
      kex: ['diffie-hellman-group14-sha1'],
      cipher: ['aes128-cbc'],
      hmac: ['hmac-sha1']
    })
    const term = await connect(IN_PROCESS_PORT)
    try {
      const alg = negotiated(term)
      assert.equal(alg.kex, 'diffie-hellman-group14-sha1')
      assert.equal(alg.cs.cipher, 'aes128-cbc')
      assert.equal(alg.cs.mac, 'hmac-sha1')
      assert.ok(term.altAlg, 'expected the alt algorithm retry to have run')
    } finally {
      closeSession(term)
    }
  })

  test('runs a shell over a legacy connection', async () => {
    await startPinned({
      kex: ['diffie-hellman-group1-sha1'],
      cipher: ['3des-cbc'],
      hmac: ['hmac-md5']
    })
    const term = await connect(IN_PROCESS_PORT, { enableSsh: true })
    try {
      assert.equal(negotiated(term).kex, 'diffie-hellman-group1-sha1')
      // the uppercase output can not come from the echo of the typed command,
      // so matching it proves the command really ran on the legacy connection
      const out = await waitForData(
        term,
        /LEGACY-SHELL-OK/,
        'echo legacy-shell-ok | tr a-z A-Z'
      )
      assert.match(out, /LEGACY-SHELL-OK/)
    } finally {
      closeSession(term)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// layer 2 — real OpenSSH docker rig, pinned per-port sshd profiles
// ─────────────────────────────────────────────────────────────────────────────

function dockerAvailable () {
  try {
    docker('info')
    return true
  } catch {
    return false
  }
}

function imageExists () {
  try {
    docker(`image inspect ${RIG_IMAGE}`)
    return true
  } catch {
    return false
  }
}

function containerRunning () {
  try {
    const out = docker(`inspect -f '{{.State.Running}}' ${RIG_CONTAINER}`)
    return out.trim() === 'true'
  } catch {
    return false
  }
}

function startRig () {
  try {
    docker(`rm -f ${RIG_CONTAINER}`)
  } catch {
    // not there, nothing to remove
  }
  docker(
    `run -d --name ${RIG_CONTAINER}` +
    ` -p ${RIG_GROUP1}:${RIG_GROUP1} -p ${RIG_GROUP14}:${RIG_GROUP14}` +
    ` -p ${RIG_GEX}:${RIG_GEX} -p ${RIG_OLD_DEVICE}:${RIG_OLD_DEVICE}` +
    ` ${RIG_IMAGE}`,
    { timeout: 120000 }
  )
}

function waitForPort (port, timeout = READY_TIMEOUT) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function tryConnect () {
      if (Date.now() - start > timeout) {
        return reject(new Error(`Timeout waiting for 127.0.0.1:${port}`))
      }
      const sock = net.connect(port, '127.0.0.1')
      sock.setTimeout(2000)
      sock.on('connect', () => {
        sock.destroy()
        resolve()
      })
      sock.on('error', () => {
        sock.destroy()
        setTimeout(tryConnect, 500)
      })
      sock.on('timeout', () => {
        sock.destroy()
        setTimeout(tryConnect, 500)
      })
    }
    tryConnect()
  })
}

describe('legacy ssh algorithms — real OpenSSH rig (docker)', () => {
  let available = false

  before(async () => {
    if (!dockerAvailable()) {
      console.log('Docker not available — skipping docker rig tests')
      return
    }
    if (!imageExists()) {
      console.log(`Docker image ${RIG_IMAGE} missing — enable these tests with ` +
        `"docker build -t ${RIG_IMAGE} ${path.relative(process.cwd(), RIG_DIR)}"`)
      return
    }
    if (!containerRunning()) {
      console.log('Starting legacy-ssh rig...')
      startRig()
    }
    await waitForPort(RIG_GROUP1)
    await waitForPort(RIG_OLD_DEVICE)
    await delay(500)
    available = true
  })

  after(() => {
    // rig is left running for debugging; `docker rm -f electerm-legacy-ssh` cleans up
  })

  test('connects to sshd pinned to diffie-hellman-group1-sha1 + CBC', async (t) => {
    if (!available) {
      return t.skip('docker rig not available')
    }
    const term = await connectRig(RIG_GROUP1)
    try {
      const alg = negotiated(term)
      assert.equal(alg.kex, 'diffie-hellman-group1-sha1')
      assert.equal(alg.serverHostKey, 'ssh-rsa')
      assert.equal(alg.cs.cipher, 'aes128-cbc')
      assert.equal(alg.cs.mac, 'hmac-sha1')
    } finally {
      closeSession(term)
    }
  })

  test('connects to sshd pinned to diffie-hellman-group14-sha1', async (t) => {
    if (!available) {
      return t.skip('docker rig not available')
    }
    const term = await connectRig(RIG_GROUP14)
    try {
      assert.equal(negotiated(term).kex, 'diffie-hellman-group14-sha1')
    } finally {
      closeSession(term)
    }
  })

  test('connects to sshd pinned to diffie-hellman-group-exchange-sha1', async (t) => {
    if (!available) {
      return t.skip('docker rig not available')
    }
    const term = await connectRig(RIG_GEX)
    try {
      assert.equal(negotiated(term).kex, 'diffie-hellman-group-exchange-sha1')
    } finally {
      closeSession(term)
    }
  })

  test('runs a shell on the old-device profile (legacy kex + CBC + hmac-sha1 + ssh-rsa)', async (t) => {
    if (!available) {
      return t.skip('docker rig not available')
    }
    const term = await connectRig(RIG_OLD_DEVICE, { enableSsh: true })
    try {
      const alg = negotiated(term)
      assert.ok(
        alg.kex.startsWith('diffie-hellman-group'),
        `expected a legacy group kex, got ${alg.kex}`
      )
      assert.equal(alg.serverHostKey, 'ssh-rsa')
      assert.equal(alg.cs.cipher, 'aes128-cbc')
      assert.equal(alg.cs.mac, 'hmac-sha1')
      // "Linux" can only come from the remote `uname -s` output (the echoed
      // command line does not contain it), and it arrives after the marker
      const out = await waitForData(
        term,
        /Linux/,
        'echo legacy-shell-ok | tr a-z A-Z; uname -s',
        10000
      )
      assert.match(out, /LEGACY-SHELL-OK/)
      assert.match(out, /Linux/)
    } finally {
      closeSession(term)
    }
  })
})

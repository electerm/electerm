/**
 * SSH agent integration tests.
 *
 * These tests confirm that SSH agent authentication continues to work
 * correctly across the following scenarios that are NOT covered by the
 * existing session-ssh.spec.js suite:
 *
 *  1. Agent when sshKeysPath contains NON-matching key files.
 *     The createAuthHandler isMethodAllowed fix (commit f05ef847) makes the
 *     agent method eligible whenever the server advertises "publickey".  A
 *     regression to that fix would cause all agent logins to fail silently
 *     whenever the user has any key files on disk.
 *
 *  2. Agent discovered via process.env.SSH_AUTH_SOCK (no explicit sshAgent
 *     option).  The existing tests always pass sshAgent explicitly; this
 *     covers the implicit path used by most desktop setups.
 *
 *  3. exports.test() (connection probe) with SSH agent.
 *     Before commit a357c4a3 the ws object was not forwarded to the probe,
 *     so the host-key verification prompt (added in 409f3291) would wait
 *     forever when connecting to a new host.
 *
 * All tests mock the electron environment and run exclusively with Node.js
 * built-ins + the packages already bundled with electerm.
 */

process.env.NODE_ENV = 'development'

const { describe, test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
const { spawnSync } = require('node:child_process')
const { Server, utils } = require('@electerm/ssh2')
const { session, test: sshTest } = require('../../src/app/server/session-ssh')

// ─── constants ────────────────────────────────────────────────────────────────

const USERNAME = 'agent-tester'

// A fresh server host key for every test run.
const HOST_KEY = utils.generateKeyPairSync('ed25519', {
  comment: 'electerm-agent-test-host'
})

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseKey (key) {
  let parsed = utils.parseKey(key)
  if (Array.isArray(parsed)) parsed = parsed[0]
  if (parsed instanceof Error) throw parsed
  return parsed
}

function publicKeyMatchesCtx (ctx, publicKeyPem) {
  return Buffer.compare(
    parseKey(publicKeyPem).getPublicSSH(),
    ctx.key.data
  ) === 0
}

function runCommand (command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited ${result.status}: ${result.stderr || result.stdout}`
    )
  }
  return result.stdout
}

function generateKey ({ dir, name, type = 'ed25519', passphrase = '', bits }) {
  const keyPath = path.join(dir, name)
  const args = ['-q', '-t', type]
  if (bits) args.push('-b', String(bits))
  args.push('-N', passphrase, '-f', keyPath, '-C', `electerm-${name}`)
  runCommand('ssh-keygen', args)
  return {
    keyPath,
    privateKey: fs.readFileSync(keyPath, 'utf8'),
    publicKey: fs.readFileSync(`${keyPath}.pub`, 'utf8')
  }
}

/**
 * Start ssh-agent on a unique socket and load the given key into it.
 * Returns { env, kill }.
 */
function startAgent (keyPath) {
  // Use a socket path that is predictable enough for debugging but unique.
  const socketPath = path.join(
    os.tmpdir(),
    `ea-agent-${process.pid}-${Date.now()}.sock`
  )
  const output = runCommand('ssh-agent', ['-a', socketPath, '-s'])
  const sockMatch = output.match(/SSH_AUTH_SOCK=([^;]+)/)
  const pidMatch = output.match(/SSH_AGENT_PID=([^;]+)/)
  if (!sockMatch || !pidMatch) {
    throw new Error(`Cannot parse ssh-agent output:\n${output}`)
  }
  const env = {
    ...process.env,
    SSH_AUTH_SOCK: sockMatch[1],
    SSH_AGENT_PID: pidMatch[1]
  }
  if (keyPath) {
    runCommand('ssh-add', [keyPath], { env })
  }
  return {
    env,
    kill () {
      try { runCommand('ssh-agent', ['-k'], { env }) } catch (_) { /* ignore */ }
    }
  }
}

/**
 * Start a minimal SSH server that only accepts publickey auth for USERNAME
 * using the provided public-key string.
 *
 * Returns { port, close }.
 */
async function startServer (allowedPublicKey, { debug = false } = {}) {
  const clients = new Set()
  const server = new Server({ hostKeys: [HOST_KEY.private] }, (client) => {
    clients.add(client)
    client.on('close', () => clients.delete(client))
    client.on('end', () => clients.delete(client))

    client.on('authentication', (ctx) => {
      if (debug) {
        console.log('[server] auth method:', ctx.method, 'user:', ctx.username)
      }
      if (ctx.method === 'none') {
        return ctx.reject(['publickey'])
      }
      if (
        ctx.method === 'publickey' &&
        ctx.username === USERNAME &&
        publicKeyMatchesCtx(ctx, allowedPublicKey)
      ) {
        if (debug) console.log('[server] accepted publickey auth')
        return ctx.accept()
      }
      // reject but keep publickey in the advertised list so the client can
      // try the ssh agent after failing with a file key
      return ctx.reject(['publickey'])
    })

    client.on('ready', () => {
      client.on('session', (accept) => {
        const sess = accept()
        sess.on('env', (accept) => accept())
        sess.on('pty', (accept) => accept())
        sess.on('shell', (accept) => {
          const stream = accept()
          stream.write('electerm-agent-test ready\n')
        })
      })
    })
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  if (debug) console.log('[server] listening on port', port)

  return {
    port,
    async close () {
      for (const c of clients) c.end()
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    }
  }
}

/**
 * Minimal ws mock that automatically trusts unknown host keys.
 * Any non-confirm interactive prompt rejects with an error so tests fail
 * loudly if an unexpected prompt appears.
 */
function makeWs ({ allowNonConfirmPrompts = false, debug = false } = {}) {
  let pendingHandler = null
  let pendingOptions = null
  return {
    s (payload) {
      if (payload?.action !== 'session-interactive') return
      pendingOptions = payload.options
      if (debug) {
        console.log('[ws] session-interactive', JSON.stringify({
          mode: payload.options?.mode,
          name: payload.options?.name,
          prompts: (payload.options?.prompts || []).map(p => p.prompt)
        }))
      }
    },
    once (handler) {
      const opts = pendingOptions
      queueMicrotask(() => {
        if (opts?.mode === 'confirm') {
          // Auto-trust the host key
          if (debug) console.log('[ws] auto-trusting host key')
          handler({ results: ['trust'] })
        } else if (allowNonConfirmPrompts) {
          handler({ results: pendingHandler ? pendingHandler(opts) : [] })
        } else {
          // Fail loudly – agent login should not need interactive prompts
          handler({ results: [] }) // empty results → reject('User cancel')
        }
      })
      pendingHandler = null
    },
    close () {}
  }
}

function setEnv (name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

// ─── fixture management ────────────────────────────────────────────────────────

describe('SSH agent auth', () => {
  let tmpDir
  let savedEnv

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-agent-test-'))

    savedEnv = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
      SSH_AGENT_PID: process.env.SSH_AGENT_PID,
      sshKeysPath: process.env.sshKeysPath
    }

    const homeDir = path.join(tmpDir, 'home')
    const sshKeysDir = path.join(tmpDir, 'ssh-keys')
    fs.mkdirSync(homeDir, { recursive: true })
    fs.mkdirSync(sshKeysDir, { recursive: true })

    setEnv('HOME', homeDir)
    setEnv('USERPROFILE', homeDir)
    setEnv('SSH_AUTH_SOCK', undefined)
    setEnv('SSH_AGENT_PID', undefined)
    setEnv('sshKeysPath', sshKeysDir)
  })

  afterEach(() => {
    setEnv('HOME', savedEnv.HOME)
    setEnv('USERPROFILE', savedEnv.USERPROFILE)
    setEnv('SSH_AUTH_SOCK', savedEnv.SSH_AUTH_SOCK)
    setEnv('SSH_AGENT_PID', savedEnv.SSH_AGENT_PID)
    setEnv('sshKeysPath', savedEnv.sshKeysPath)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ── test 1 ─────────────────────────────────────────────────────────────────
  test(
    'agent auth succeeds even when sshKeysPath contains non-matching key files',
    async (t) => {
      // This is the primary regression test for the isMethodAllowed fix
      // (commit f05ef847).  Without that fix the auth handler would return
      // false as soon as the key-file publickey attempt failed, because
      // "agent" is not literally in the server's ["publickey"] allow-list,
      // and the connection would be rejected with "All configured
      // authentication methods failed" before the agent was ever tried.

      let agent
      try {
        agent = startAgent() // start without a key first – we load it below
      } catch (err) {
        if (err.code === 'ENOENT') {
          t.skip('ssh-agent / ssh-keygen not available')
          return
        }
        throw err
      }

      const sshKeysDir = process.env.sshKeysPath

      // Generate the key the server will accept and load it into the agent.
      const agentKey = generateKey({ dir: tmpDir, name: 'agent-key' })
      runCommand('ssh-add', [agentKey.keyPath], { env: agent.env })

      // Generate a DIFFERENT key that lives in sshKeysPath.
      // The code will try this one first (publickey auth) and it will fail.
      // Agent must then be tried automatically.
      const wrongKey = generateKey({ dir: sshKeysDir, name: 'wrong-key' })
      // Also place the matching .pub file so getSSHKeys() finds it.
      fs.copyFileSync(`${wrongKey.keyPath}.pub`, path.join(sshKeysDir, 'wrong-key.pub'))

      setEnv('SSH_AUTH_SOCK', agent.env.SSH_AUTH_SOCK)
      setEnv('SSH_AGENT_PID', agent.env.SSH_AGENT_PID)

      const server = await startServer(agentKey.publicKey, { debug: true })
      let term
      try {
        term = await session({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          sshAgent: agent.env.SSH_AUTH_SOCK,
          useSshAgent: true,
          enableSsh: false,
          readyTimeout: 10000,
          debug: true // enables ssh2 protocol debug output
        }, makeWs({ debug: true }))

        // If we reach here the agent key was accepted.
        assert.ok(term, 'session should resolve when agent auth succeeds')
      } finally {
        term?.kill()
        await server.close()
        agent.kill()
      }
    }
  )

  // ── test 2 ─────────────────────────────────────────────────────────────────
  test(
    'agent auth works via implicit process.env.SSH_AUTH_SOCK (no explicit sshAgent option)',
    async (t) => {
      // The getAgent() method falls back to process.env.SSH_AUTH_SOCK when
      // initOptions.sshAgent is not set.  This covers the typical desktop
      // user who relies on a system-managed agent socket.

      let agent
      try {
        agent = startAgent()
      } catch (err) {
        if (err.code === 'ENOENT') {
          t.skip('ssh-agent / ssh-keygen not available')
          return
        }
        throw err
      }

      const agentKey = generateKey({ dir: tmpDir, name: 'implicit-agent-key' })
      runCommand('ssh-add', [agentKey.keyPath], { env: agent.env })

      // Expose the agent socket via the environment variable only – do NOT
      // set initOptions.sshAgent.
      setEnv('SSH_AUTH_SOCK', agent.env.SSH_AUTH_SOCK)
      setEnv('SSH_AGENT_PID', agent.env.SSH_AGENT_PID)

      const server = await startServer(agentKey.publicKey, { debug: true })
      let term
      try {
        term = await session({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          // No sshAgent option – should discover SSH_AUTH_SOCK automatically
          useSshAgent: true,
          enableSsh: false,
          readyTimeout: 10000,
          debug: true
        }, makeWs({ debug: true }))

        assert.ok(term, 'session should resolve when implicit agent is used')
      } finally {
        term?.kill()
        await server.close()
        agent.kill()
      }
    }
  )

  // ── test 3 ─────────────────────────────────────────────────────────────────
  test(
    'exports.test (connection probe) returns true with SSH agent on a new host',
    async (t) => {
      // Before commit a357c4a3, exports.test() did not forward ws to the
      // TerminalSsh instance.  The host-key verifier added in 409f3291 calls
      // onKeyboardEvent() which sends a session-interactive event to ws and
      // then awaits a reply.  With ws === undefined the await never resolved,
      // causing the probe to hang.  This test would time out under that bug.

      let agent
      try {
        agent = startAgent()
      } catch (err) {
        if (err.code === 'ENOENT') {
          t.skip('ssh-agent / ssh-keygen not available')
          return
        }
        throw err
      }

      const agentKey = generateKey({ dir: tmpDir, name: 'probe-agent-key' })
      runCommand('ssh-add', [agentKey.keyPath], { env: agent.env })

      setEnv('SSH_AUTH_SOCK', agent.env.SSH_AUTH_SOCK)
      setEnv('SSH_AGENT_PID', agent.env.SSH_AGENT_PID)

      const server = await startServer(agentKey.publicKey, { debug: true })
      try {
        const ok = await sshTest({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          sshAgent: agent.env.SSH_AUTH_SOCK,
          useSshAgent: true,
          readyTimeout: 10000,
          debug: true
        }, makeWs({ debug: true })) // ws must be forwarded (fixed in a357c4a3)

        assert.equal(ok, true, 'sshTest should return true when agent auth succeeds')
      } finally {
        await server.close()
        agent.kill()
      }
    }
  )

  // ── test 4 ─────────────────────────────────────────────────────────────────
  test(
    'agent auth with a new host requires host-key confirmation and then succeeds',
    async (t) => {
      // Confirm that the host-key verification dialog (409f3291) does not
      // interfere with subsequent agent-based authentication.  A fresh HOME
      // dir is used so known_hosts starts empty.

      let agent
      try {
        agent = startAgent()
      } catch (err) {
        if (err.code === 'ENOENT') {
          t.skip('ssh-agent / ssh-keygen not available')
          return
        }
        throw err
      }

      const agentKey = generateKey({ dir: tmpDir, name: 'new-host-agent-key' })
      runCommand('ssh-add', [agentKey.keyPath], { env: agent.env })

      setEnv('SSH_AUTH_SOCK', agent.env.SSH_AUTH_SOCK)
      setEnv('SSH_AGENT_PID', agent.env.SSH_AGENT_PID)

      const server = await startServer(agentKey.publicKey, { debug: true })

      let confirmCount = 0
      const ws = {
        s (payload) {
          if (payload?.action !== 'session-interactive') return
          if (payload.options?.mode === 'confirm') {
            confirmCount++
            console.log('[ws] host-key confirm dialog received (#' + confirmCount + ')')
          } else {
            // Any non-confirm prompt during agent login is unexpected
            console.error('[ws] unexpected non-confirm prompt:', payload.options)
          }
        },
        once (handler) {
          queueMicrotask(() => handler({ results: ['trust'] }))
        },
        close () {}
      }

      let term
      try {
        term = await session({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          sshAgent: agent.env.SSH_AUTH_SOCK,
          useSshAgent: true,
          enableSsh: false,
          readyTimeout: 10000,
          debug: true
        }, ws)

        assert.ok(term, 'session should resolve after trusting the host key')
        assert.equal(
          confirmCount,
          1,
          'exactly one host-key confirmation prompt should appear for a new host'
        )

        // Verify the host was saved to known_hosts
        const knownHostsPath = path.join(process.env.HOME, '.ssh', 'known_hosts')
        const knownHostsContent = fs.readFileSync(knownHostsPath, 'utf8')
        assert.match(
          knownHostsContent,
          /127\.0\.0\.1/,
          'server should be recorded in known_hosts after trusting'
        )
      } finally {
        term?.kill()
        await server.close()
        agent.kill()
      }
    }
  )
})

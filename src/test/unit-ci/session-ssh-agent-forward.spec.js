/**
 * SSH agent forwarding integration tests.
 *
 * `agentForward` (the bookmark flag added for the "connect to a bastion host
 * first, then hop further from there" workflow, equivalent to `ssh -A`) is
 * wired straight into ssh2's `agentForward` connect option. These tests pin
 * the three things that are easy to get wrong:
 *
 *  1. The flag actually reaches the wire: the server must see exactly one
 *     `auth-agent-req@openssh.com` request on the session channel.
 *  2. The default is unchanged: without the flag nothing is requested, so
 *     existing bookmarks behave exactly as before.
 *  3. The flag is never passed to ssh2 without a usable agent. ssh2 throws
 *     "You must set a valid agent path to allow agent forwarding" at connect
 *     time, which would break connections where the agent is switched off.
 *
 * Plus the refusal path: ssh2 fails the whole shell request when the server
 * refuses agent forwarding (AllowAgentForwarding no), while OpenSSH only
 * warns. session-ssh.openShell() is expected to drop the flag and open the
 * shell again on the same connection instead of failing the session.
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
const { session } = require('../../../src/app/server/session-ssh')

// ─── constants ────────────────────────────────────────────────────────────────

const USERNAME = 'agent-forward-tester'

// A fresh server host key for every test run.
const HOST_KEY = utils.generateKeyPairSync('ed25519', {
  comment: 'electerm-agent-forward-test-host'
})

// ─── helpers ──────────────────────────────────────────────────────────────────

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

function generateKey ({ dir, name, type = 'ed25519' }) {
  const keyPath = path.join(dir, name)
  runCommand('ssh-keygen', ['-q', '-t', type, '-N', '', '-f', keyPath, '-C', `electerm-${name}`])
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
  const socketPath = path.join(
    os.tmpdir(),
    `ea-fwd-agent-${process.pid}-${Date.now()}.sock`
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
 * Start a minimal SSH server that accepts any publickey auth for USERNAME and
 * records agent forwarding requests.
 *
 * With acceptAgentForward = false no `auth-agent` listener is registered,
 * which is how ssh2's server expresses "this server refuses to forward the
 * agent" (the same thing an OpenSSH server with AllowAgentForwarding no does
 * over the wire).
 *
 * Returns { port, state, close } where state counts what the server saw.
 */
async function startServer ({ acceptAgentForward = false, debug = false } = {}) {
  const clients = new Set()
  const state = {
    agentForwardRequests: 0,
    shells: 0
  }
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
      if (ctx.method === 'publickey' && ctx.username === USERNAME) {
        return ctx.accept()
      }
      return ctx.reject(['publickey'])
    })

    client.on('ready', () => {
      client.on('session', (accept) => {
        const sess = accept()
        // electerm sends env without wantReply, so accept can be undefined
        const acceptIfAsked = (accept) => {
          if (typeof accept === 'function') accept()
        }
        sess.on('env', acceptIfAsked)
        sess.on('pty', acceptIfAsked)
        if (acceptAgentForward) {
          sess.on('auth-agent', (accept) => {
            state.agentForwardRequests++
            if (debug) console.log('[server] accepted agent forwarding request')
            accept()
          })
        }
        sess.on('shell', (accept) => {
          state.shells++
          const stream = accept()
          stream.write('electerm-agent-forward-test ready\n')
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
    state,
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
 * Any non-confirm interactive prompt rejects, so tests fail loudly if an
 * unexpected prompt appears.
 */
function makeWs ({ debug = false } = {}) {
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
          if (debug) console.log('[ws] auto-trusting host key')
          handler({ results: ['trust'] })
        } else {
          handler({ results: [] }) // empty results → reject('User cancel')
        }
      })
    },
    close () {}
  }
}

function setEnv (name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

// ─── fixture management ───────────────────────────────────────────────────────

describe('SSH agent forwarding', () => {
  let tmpDir
  let savedEnv

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-agent-fwd-test-'))

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
    'agentForward: true requests agent forwarding on the session channel',
    async (t) => {
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

      const key = generateKey({ dir: tmpDir, name: 'fwd-key' })
      runCommand('ssh-add', [key.keyPath], { env: agent.env })

      const server = await startServer({ acceptAgentForward: true })
      let term
      try {
        term = await session({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          sshAgent: agent.env.SSH_AUTH_SOCK,
          useSshAgent: true,
          agentForward: true,
          readyTimeout: 10000
        }, makeWs())

        assert.ok(term, 'session should resolve')
        assert.equal(
          server.state.agentForwardRequests,
          1,
          'server should have seen exactly one auth-agent request'
        )
        assert.equal(server.state.shells, 1, 'shell should be opened once')
      } finally {
        term?.kill()
        await server.close()
        agent.kill()
      }
    }
  )

  // ── test 2 ─────────────────────────────────────────────────────────────────
  test(
    'agent forwarding is not requested when the flag is off (default)',
    async (t) => {
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

      const key = generateKey({ dir: tmpDir, name: 'fwd-key' })
      runCommand('ssh-add', [key.keyPath], { env: agent.env })

      const server = await startServer({ acceptAgentForward: true })
      let term
      try {
        term = await session({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          sshAgent: agent.env.SSH_AUTH_SOCK,
          useSshAgent: true,
          readyTimeout: 10000
        }, makeWs())

        assert.ok(term, 'session should resolve')
        assert.equal(
          server.state.agentForwardRequests,
          0,
          'no auth-agent request expected without the flag'
        )
      } finally {
        term?.kill()
        await server.close()
        agent.kill()
      }
    }
  )

  // ── test 3 ─────────────────────────────────────────────────────────────────
  test(
    'agentForward without a usable agent does not break the connection',
    async (t) => {
      // ssh2 throws at connect time when agentForward is set but no agent is
      // available, so session-ssh must drop the flag in that case.
      const key = generateKey({ dir: tmpDir, name: 'file-key' })

      const server = await startServer({ acceptAgentForward: true })
      let term
      try {
        term = await session({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          privateKey: key.privateKey,
          useSshAgent: false,
          agentForward: true,
          readyTimeout: 10000
        }, makeWs())

        assert.ok(term, 'session should resolve with file key auth')
        assert.equal(
          server.state.agentForwardRequests,
          0,
          'nothing to forward when there is no agent'
        )
      } finally {
        term?.kill()
        await server.close()
      }
    }
  )

  // ── test 4 ─────────────────────────────────────────────────────────────────
  test(
    'a server refusing agent forwarding still gets a working session',
    async (t) => {
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

      const key = generateKey({ dir: tmpDir, name: 'fwd-key' })
      runCommand('ssh-add', [key.keyPath], { env: agent.env })

      // acceptAgentForward: false → the request is refused, exactly like an
      // OpenSSH server with AllowAgentForwarding no
      const server = await startServer({ acceptAgentForward: false })
      let term
      try {
        term = await session({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          sshAgent: agent.env.SSH_AUTH_SOCK,
          useSshAgent: true,
          agentForward: true,
          readyTimeout: 10000
        }, makeWs())

        assert.ok(term, 'session should resolve even when forwarding is refused')
        assert.equal(server.state.agentForwardRequests, 0, 'request was refused')
        assert.equal(
          server.state.shells,
          1,
          'shell should be opened once, on the retry without forwarding'
        )
      } finally {
        term?.kill()
        await server.close()
        agent.kill()
      }
    }
  )
})

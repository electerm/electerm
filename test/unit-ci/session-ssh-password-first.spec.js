/**
 * Test: when password is provided, password auth should be tried first
 * before publickey/agent, even if ~/.ssh has keys available.
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
const { session } = require('../../src/app/server/session-ssh')

const USERNAME = 'tester'
const PASSWORD = 'electerm-test-password'

const HOST_KEY = utils.generateKeyPairSync('ed25519', {
  comment: 'electerm-test-host'
})

function parseKey (key, passphrase) {
  let parsed = utils.parseKey(key, passphrase)
  if (Array.isArray(parsed)) {
    parsed = parsed[0]
  }
  if (parsed instanceof Error) {
    throw parsed
  }
  return parsed
}

function matchesPublicKey (ctx, publicKey) {
  return Buffer.compare(
    parseKey(publicKey).getPublicSSH(),
    ctx.key.data
  ) === 0
}

function makeTmpDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-ssh-test-'))
}

function setEnvVar (name, value) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

function runCommand (command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

function generateClientKey ({ dir, name, type, passphrase, bits }) {
  const keyPath = path.join(dir, name)
  const args = ['-q', '-t', type]

  if (bits) {
    args.push('-b', String(bits))
  }

  args.push(
    '-N',
    passphrase || '',
    '-f',
    keyPath,
    '-C',
    `electerm-${name}`
  )

  runCommand('ssh-keygen', args)

  return {
    keyPath,
    privateKey: fs.readFileSync(keyPath, 'utf8'),
    publicKey: fs.readFileSync(`${keyPath}.pub`, 'utf8')
  }
}

/**
 * Start an SSH server that tracks which auth methods are attempted.
 * @param {string} publicKey - The public key to accept for publickey auth
 * @returns {{ port: number, authAttempts: string[], close: () => Promise<void> }}
 */
async function startTrackingServer (publicKey) {
  const clients = new Set()
  const authAttempts = []

  const server = new Server({
    hostKeys: [HOST_KEY.private]
  }, (client) => {
    clients.add(client)
    const cleanup = () => clients.delete(client)

    client.on('close', cleanup)
    client.on('end', cleanup)
    client.on('authentication', (ctx) => {
      authAttempts.push(ctx.method)

      if (ctx.method === 'none') {
        return ctx.reject(['publickey', 'password'])
      }

      // Accept password auth
      if (ctx.method === 'password' && ctx.username === USERNAME && ctx.password === PASSWORD) {
        return ctx.accept()
      }

      // Accept publickey auth
      if (ctx.method === 'publickey' && ctx.username === USERNAME && matchesPublicKey(ctx, publicKey)) {
        return ctx.accept()
      }

      ctx.reject(['publickey', 'password'])
    })
    client.on('ready', () => {
      client.on('session', (accept) => {
        const sshSession = accept()
        sshSession.on('env', (accept) => accept())
        sshSession.on('pty', (accept) => accept())
        sshSession.on('shell', (accept) => {
          const stream = accept()
          stream.write('electerm ready\n')
        })
      })
    })
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  return {
    port: server.address().port,
    authAttempts,
    async close () {
      for (const client of clients) {
        client.end()
      }
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
  }
}

function createPromptWs () {
  return {
    prompts: [],
    s (payload) {},
    once (handler) {
      queueMicrotask(() => {
        handler({ results: ['trust'] })
      })
    },
    close () {}
  }
}

describe('session-ssh password-first auth', () => {
  let tmpDir
  let oldEnv

  beforeEach(() => {
    tmpDir = makeTmpDir()
    oldEnv = {
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

    setEnvVar('HOME', homeDir)
    setEnvVar('USERPROFILE', homeDir)
    setEnvVar('SSH_AUTH_SOCK', undefined)
    setEnvVar('SSH_AGENT_PID', undefined)
    setEnvVar('sshKeysPath', sshKeysDir)
  })

  afterEach(() => {
    setEnvVar('HOME', oldEnv.HOME)
    setEnvVar('USERPROFILE', oldEnv.USERPROFILE)
    setEnvVar('SSH_AUTH_SOCK', oldEnv.SSH_AUTH_SOCK)
    setEnvVar('SSH_AGENT_PID', oldEnv.SSH_AGENT_PID)
    setEnvVar('sshKeysPath', oldEnv.sshKeysPath)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('when password is provided, password auth is tried before publickey from ~/.ssh keys', async () => {
    // Generate a key pair and put it in the sshKeysPath (simulating ~/.ssh)
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'id_ed25519',
      type: 'ed25519',
      passphrase: ''
    })

    // Copy public key to sshKeysDir so getSSHKeys() finds it
    const sshKeysDir = path.join(tmpDir, 'ssh-keys')
    fs.copyFileSync(keyPair.keyPath, path.join(sshKeysDir, 'id_ed25519'))
    fs.copyFileSync(`${keyPair.keyPath}.pub`, path.join(sshKeysDir, 'id_ed25519.pub'))

    // Start server that accepts both password and publickey
    const server = await startTrackingServer(keyPair.publicKey)
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
        readyTimeout: 5000
      }, ws)

      // Verify the connection succeeded
      assert.ok(term, 'session should be created')

      // The key assertion: password should be the first real auth attempt
      // (after 'none' which is always first)
      const authMethods = server.authAttempts
      const firstRealAuth = authMethods.find(m => m !== 'none')
      assert.equal(firstRealAuth, 'password',
        `Expected password to be tried first, but auth attempts were: ${JSON.stringify(authMethods)}`)

      // Password should appear before any publickey attempt
      const passwordIndex = authMethods.indexOf('password')
      const publickeyIndex = authMethods.indexOf('publickey')
      if (publickeyIndex !== -1) {
        assert.ok(passwordIndex < publickeyIndex,
          `password (index ${passwordIndex}) should be tried before publickey (index ${publickeyIndex}), auth attempts: ${JSON.stringify(authMethods)}`)
      }
    } finally {
      if (term) {
        term.kill()
      }
      await server.close()
    }
  })

  test('when password is provided with agent available, password is still tried first', async () => {
    // Generate a key pair and put it in sshKeysPath
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'id_rsa',
      type: 'rsa',
      bits: 2048,
      passphrase: ''
    })

    const sshKeysDir = path.join(tmpDir, 'ssh-keys')
    fs.copyFileSync(keyPair.keyPath, path.join(sshKeysDir, 'id_rsa'))
    fs.copyFileSync(`${keyPair.keyPath}.pub`, path.join(sshKeysDir, 'id_rsa.pub'))

    // Start server that accepts both password and publickey
    const server = await startTrackingServer(keyPair.publicKey)
    const ws = createPromptWs()

    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        password: PASSWORD,
        // Don't disable agent - let it be set naturally
        // useSshAgent defaults to checking SSH_AUTH_SOCK
        enableSsh: false,
        readyTimeout: 5000
      }, ws)

      assert.ok(term, 'session should be created')

      const authMethods = server.authAttempts
      const firstRealAuth = authMethods.find(m => m !== 'none')
      assert.equal(firstRealAuth, 'password',
        `Expected password to be tried first, but auth attempts were: ${JSON.stringify(authMethods)}`)
    } finally {
      if (term) {
        term.kill()
      }
      await server.close()
    }
  })

  test('when only password is provided (no keys in ~/.ssh), password auth works', async () => {
    // No keys in sshKeysDir - only password available
    const server = await startTrackingServer(null)
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
        readyTimeout: 5000
      }, ws)

      assert.ok(term, 'session should be created')

      const authMethods = server.authAttempts
      assert.ok(authMethods.includes('password'),
        `password auth should have been attempted, auth attempts: ${JSON.stringify(authMethods)}`)
    } finally {
      if (term) {
        term.kill()
      }
      await server.close()
    }
  })

  test('with isMFA and password provided, ~/.ssh keys are NOT loaded (no passphrase dialog)', async () => {
    // Generate a key with passphrase - simulating ~/.ssh key that would trigger passphrase dialog
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'id_ed25519_passphrase',
      type: 'ed25519',
      passphrase: 'key-passphrase'
    })

    // Copy key to sshKeysDir so getSSHKeys() would find it
    const sshKeysDir = path.join(tmpDir, 'ssh-keys')
    fs.copyFileSync(keyPair.keyPath, path.join(sshKeysDir, 'id_ed25519_passphrase'))
    fs.copyFileSync(`${keyPair.keyPath}.pub`, path.join(sshKeysDir, 'id_ed25519_passphrase.pub'))

    // Server only accepts password (simulating bastion host)
    const authAttempts = []
    const clients = new Set()
    const server = new Server({
      hostKeys: [HOST_KEY.private]
    }, (client) => {
      clients.add(client)
      client.on('close', () => clients.delete(client))
      client.on('end', () => clients.delete(client))
      client.on('authentication', (ctx) => {
        authAttempts.push(ctx.method)
        if (ctx.method === 'none') {
          return ctx.reject(['keyboard-interactive', 'password'])
        }
        if (ctx.method === 'password' && ctx.username === USERNAME && ctx.password === PASSWORD) {
          return ctx.accept()
        }
        if (ctx.method === 'keyboard-interactive' && ctx.username === USERNAME) {
          return ctx.prompt(
            [{ prompt: 'Password:', echo: false }],
            'instructions',
            'lang',
            (responses) => {
              if (responses[0] === PASSWORD) {
                ctx.accept()
              } else {
                ctx.reject(['keyboard-interactive', 'password'])
              }
            }
          )
        }
        ctx.reject(['keyboard-interactive', 'password'])
      })
      client.on('ready', () => {
        client.on('session', (accept) => {
          const sshSession = accept()
          sshSession.on('env', (accept) => accept())
          sshSession.on('pty', (accept) => accept())
          sshSession.on('shell', (accept) => {
            const stream = accept()
            stream.write('electerm ready\n')
          })
        })
      })
    })

    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const port = server.address().port

    // Track if any passphrase prompt appears
    let passphrasePrompted = false
    const ws = {
      prompts: [],
      s (payload) {
        if (payload && payload.action === 'session-interactive') {
          this.prompts.push(payload.options)
          // Check if this is a passphrase prompt
          if (payload.options?.prompts?.[0]?.prompt?.toLowerCase().includes('passphrase') ||
              payload.options?.name?.toLowerCase().includes('passphase')) {
            passphrasePrompted = true
          }
        }
      },
      once (handler) {
        queueMicrotask(() => {
          handler({ results: ['trust'] })
        })
      },
      close () {}
    }

    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port,
        username: USERNAME,
        password: PASSWORD,
        isMFA: true,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)

      assert.ok(term, 'session should be created')
      assert.equal(passphrasePrompted, false,
        'Should NOT prompt for key passphrase when password is provided in bookmark')

      // Verify password or keyboard-interactive was used, NOT publickey
      const hasPublickey = authAttempts.includes('publickey')
      assert.equal(hasPublickey, false,
        `publickey auth should NOT be attempted when password is provided, auth attempts: ${JSON.stringify(authAttempts)}`)
    } finally {
      if (term) {
        term.kill()
      }
      for (const client of clients) {
        client.end()
      }
      await new Promise((resolve) => server.close(resolve))
    }
  })
})

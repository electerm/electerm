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
const PASSWORD = 'electerm-test'
const OTP = '123456'
const PASSPHRASE = 'electerm-passphrase'

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

async function startServer (authHandler) {
  const clients = new Set()
  const server = new Server({
    hostKeys: [HOST_KEY.private]
  }, (client) => {
    clients.add(client)
    const cleanup = () => clients.delete(client)

    client.on('close', cleanup)
    client.on('end', cleanup)
    client.on('authentication', (ctx) => {
      authHandler(ctx)
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

function createPromptWs (promptResponder) {
  const prompts = []
  return {
    prompts,
    s (payload) {
      if (payload && payload.action === 'session-interactive') {
        prompts.push(payload.options)
      }
    },
    once (handler) {
      const options = prompts[prompts.length - 1]
      queueMicrotask(() => {
        handler({
          results: promptResponder(options, prompts)
        })
      })
    },
    close () {}
  }
}

function publicKeyOnlyAuth (publicKey) {
  return (ctx) => {
    if (ctx.method === 'none') {
      return ctx.reject(['publickey'])
    }
    if (ctx.method === 'publickey' && ctx.username === USERNAME && matchesPublicKey(ctx, publicKey)) {
      return ctx.accept()
    }
    return ctx.reject(['publickey'])
  }
}

function sameRoundKeyboardInteractiveAuth () {
  return (ctx) => {
    if (ctx.method === 'none') {
      return ctx.reject(['keyboard-interactive'])
    }
    if (ctx.method === 'keyboard-interactive' && ctx.username === USERNAME) {
      return ctx.prompt([
        { prompt: 'Password:', echo: false },
        { prompt: 'Verification code:', echo: false }
      ], 'electerm-test', 'same-round otp', (responses) => {
        if (responses[0] === PASSWORD && responses[1] === OTP) {
          ctx.accept()
        } else {
          ctx.reject(['keyboard-interactive'])
        }
      })
    }
    return ctx.reject(['keyboard-interactive'])
  }
}

function splitRoundKeyboardInteractiveAuth (rounds = []) {
  return (ctx) => {
    if (ctx.method === 'none') {
      return ctx.reject(['keyboard-interactive'])
    }
    if (ctx.method === 'keyboard-interactive' && ctx.username === USERNAME) {
      rounds.push('otp')
      return ctx.prompt([
        { prompt: 'Verification code:', echo: false }
      ], 'electerm-test', 'otp round', (otpResponses) => {
        if (otpResponses[0] !== OTP) {
          return ctx.reject(['keyboard-interactive'])
        }
        rounds.push('password')
        ctx.prompt([
          { prompt: 'Password:', echo: false }
        ], 'electerm-test', 'password round', (passwordResponses) => {
          if (passwordResponses[0] === PASSWORD) {
            ctx.accept()
          } else {
            ctx.reject(['keyboard-interactive'])
          }
        })
      })
    }
    return ctx.reject(['keyboard-interactive'])
  }
}

function startAgent () {
  const socketPath = path.join(os.tmpdir(), `ea-${process.pid}-${Date.now()}.sock`)
  const output = runCommand('ssh-agent', ['-a', socketPath, '-s'])
  const sock = output.match(/SSH_AUTH_SOCK=([^;]+)/)
  const pid = output.match(/SSH_AGENT_PID=([^;]+)/)

  if (!sock || !pid) {
    throw new Error(`Unable to parse ssh-agent output: ${output}`)
  }

  const env = {
    ...process.env,
    SSH_AUTH_SOCK: sock[1],
    SSH_AGENT_PID: pid[1]
  }

  return {
    env,
    kill () {
      runCommand('ssh-agent', ['-k'], { env })
    }
  }
}

describe('session-ssh auth flows', () => {
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

  test('connects with an rsa key protected by a passphrase', async () => {
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'rsa-passphrase',
      type: 'rsa',
      bits: 2048,
      passphrase: PASSPHRASE
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
    const ws = createPromptWs(() => {
      throw new Error('explicit passphrase login should not prompt')
    })

    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKey: keyPair.privateKey,
        passphrase: PASSPHRASE,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)

      assert.equal(ws.prompts.length, 0)
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('connects with an ed25519 key protected by a passphrase', async () => {
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'ed25519-passphrase',
      type: 'ed25519',
      passphrase: PASSPHRASE
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
    const ws = createPromptWs(() => {
      throw new Error('explicit passphrase login should not prompt')
    })

    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKey: keyPair.privateKey,
        passphrase: PASSPHRASE,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)

      assert.equal(ws.prompts.length, 0)
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('handles password and otp in the same keyboard-interactive round', async () => {
    const server = await startServer(sameRoundKeyboardInteractiveAuth())
    const ws = createPromptWs((options) => {
      assert.equal(options.prompts.length, 2)
      return [PASSWORD, OTP]
    })

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

      assert.equal(ws.prompts.length, 1)
      assert.match(ws.prompts[0].prompts[1].prompt, /verification code/i)
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('handles otp then password across separate keyboard-interactive rounds', async () => {
    const rounds = []
    const server = await startServer(splitRoundKeyboardInteractiveAuth(rounds))
    const ws = createPromptWs((options, prompts) => {
      if (prompts.length === 1) {
        assert.match(options.prompts[0].prompt, /verification code/i)
        return [OTP]
      }
      assert.match(options.prompts[0].prompt, /password/i)
      return [PASSWORD]
    })

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

      assert.deepEqual(rounds, ['otp', 'otp', 'password'])
      assert.equal(ws.prompts.length, 1)
      assert.match(ws.prompts[0].prompts[0].prompt, /verification code/i)
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('connects with ssh agent only and leaves user keys untouched', async (t) => {
    let agent
    try {
      agent = startAgent()
    } catch (error) {
      if (error.code === 'ENOENT') {
        t.skip('ssh-agent is not available in this environment')
      }
      throw error
    }

    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'agent-ed25519',
      type: 'ed25519',
      passphrase: ''
    })

    try {
      runCommand('ssh-add', [keyPair.keyPath], { env: agent.env })
      setEnvVar('SSH_AUTH_SOCK', agent.env.SSH_AUTH_SOCK)
      setEnvVar('SSH_AGENT_PID', agent.env.SSH_AGENT_PID)

      const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
      let term
      try {
        term = await session({
          host: '127.0.0.1',
          port: server.port,
          username: USERNAME,
          sshAgent: agent.env.SSH_AUTH_SOCK,
          useSshAgent: true,
          enableSsh: false,
          readyTimeout: 5000
        }, createPromptWs(() => {
          throw new Error('ssh-agent login should not prompt')
        }))
      } finally {
        term && term.kill()
        await server.close()
      }
    } finally {
      if (agent) {
        agent.kill()
      }
    }
  })
})

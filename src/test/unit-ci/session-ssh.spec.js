process.env.NODE_ENV = 'development'

const { describe, test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
const { spawnSync } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const { Server, utils } = require('@electerm/ssh2')
const { session } = require('../../../src/app/server/session-ssh')
const log = require('../../../src/app/common/log')

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

function createPromptWs (promptResponder, options = {}) {
  const {
    includeConfirmPrompts = false,
    defaultConfirmResponse = ['trust']
  } = options
  const prompts = []
  let pendingOptions
  return {
    prompts,
    s (payload) {
      if (payload && payload.action === 'session-interactive') {
        pendingOptions = payload.options
        if (includeConfirmPrompts || payload.options?.mode !== 'confirm') {
          prompts.push(payload.options)
        }
      }
    },
    once (handler) {
      const currentOptions = pendingOptions
      queueMicrotask(() => {
        handler({
          results: currentOptions?.mode === 'confirm' && !includeConfirmPrompts
            ? defaultConfirmResponse
            : promptResponder(currentOptions, prompts)
        })
      })
    },
    close () {}
  }
}

/**
 * Records every message and never answers a prompt - the user walked away from
 * the dialog. `session-interactive-close` is how the session takes that dialog
 * down again once the attempt it belongs to is over (#4634).
 */
function createUnansweredPromptWs () {
  const sent = []
  return {
    sent,
    s (payload) {
      sent.push(payload)
    },
    once () {},
    close () {}
  }
}

function sentOf (ws, action) {
  return ws.sent.filter(d => d && d.action === action)
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

/**
 * Bastion shape that leaves the prompt label empty and puts the question in the
 * keyboard-interactive name/instructions instead, and does not set the SSH
 * partial-success flag after the password round (Aliyun's own gateway behaves
 * like this). The hidden prompt here is the SMS code, not the password.
 */
function emptyLabelOtpAuth (rounds = []) {
  return (ctx) => {
    if (ctx.method === 'none') {
      return ctx.reject(['password', 'keyboard-interactive'])
    }
    if (ctx.method === 'password' && ctx.username === USERNAME) {
      rounds.push('password')
      return ctx.password === PASSWORD
        ? ctx.reject(['keyboard-interactive'])
        : ctx.reject(['password', 'keyboard-interactive'])
    }
    if (ctx.method === 'keyboard-interactive' && ctx.username === USERNAME) {
      rounds.push('otp')
      return ctx.prompt(
        [{ prompt: '', echo: false }],
        'Two-Step Verification required',
        'Please Input Mfa Code (SMS)',
        (responses) => {
          if (responses[0] === OTP) {
            ctx.accept()
          } else {
            ctx.reject(['keyboard-interactive'])
          }
        }
      )
    }
    return ctx.reject(['password', 'keyboard-interactive'])
  }
}

/**
 * Same label-less prompt, but the question really is the password
 * (commit 6106cfde added the auto-fill for exactly this).
 */
function emptyLabelPasswordAuth () {
  return (ctx) => {
    if (ctx.method === 'none') {
      return ctx.reject(['keyboard-interactive'])
    }
    if (ctx.method === 'keyboard-interactive' && ctx.username === USERNAME) {
      return ctx.prompt(
        [{ prompt: '', echo: false }],
        'Password authentication',
        '',
        (responses) => {
          if (responses[0] === PASSWORD) {
            ctx.accept()
          } else {
            ctx.reject(['keyboard-interactive'])
          }
        }
      )
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

  test('connects with a key given as a file path only', async () => {
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'ed25519-path-only',
      type: 'ed25519'
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
    // a prompt here means the key was never read: no publickey method was
    // offered, so the session fell back to asking for a password
    const ws = createPromptWs(() => [])

    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        // no privateKey content at all - this is the whole point of the field
        privateKeyPath: keyPair.keyPath,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)

      assert.equal(ws.prompts.length, 0)
      assert.equal(term.connectOptions.privateKey, keyPair.privateKey)
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('expands ~ in the key file path', async () => {
    const sshDir = path.join(process.env.HOME, '.ssh')
    fs.mkdirSync(sshDir, { recursive: true })
    const keyPair = generateClientKey({
      dir: sshDir,
      name: 'ed25519-home',
      type: 'ed25519'
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
    const ws = createPromptWs(() => [])

    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKeyPath: '~/.ssh/ed25519-home',
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)

      assert.equal(ws.prompts.length, 0)
      assert.equal(term.connectOptions.privateKey, keyPair.privateKey)
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('key content wins over key path when both are set', async () => {
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'ed25519-content-wins',
      type: 'ed25519'
    })
    // a real, well-formed key - just not the one this server trusts, so using
    // it instead of the content fails the login instead of being ignored
    const otherKey = generateClientKey({
      dir: tmpDir,
      name: 'ed25519-not-trusted',
      type: 'ed25519'
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
    const ws = createPromptWs(() => [])

    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKey: keyPair.privateKey,
        privateKeyPath: otherKey.keyPath,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)

      assert.equal(ws.prompts.length, 0)
      assert.equal(term.connectOptions.privateKey, keyPair.privateKey)
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('fails with the real reason when the key file cannot be read', async () => {
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'ed25519-missing-file',
      type: 'ed25519'
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
    const ws = createPromptWs(() => [])

    let err
    try {
      await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKeyPath: path.join(tmpDir, 'no-such-key-file'),
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)
    } catch (e) {
      err = e
    } finally {
      await server.close()
    }

    assert.ok(err, 'connecting with an unreadable key file should fail')
    assert.match(err.message, /cannot read privateKey file/)
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

      // The code round used to be answered by dropping this connection and
      // redoing the whole keyboard-interactive exchange on a second one (hence
      // the old `['otp', 'otp', 'password']`): the server issued the otp
      // challenge, electerm hung up on it, reconnected without the password and
      // asked for the otp again. Now the round that only asks for the code is
      // answered where it was issued, so the sequence is one exchange per factor
      // and the otp prompt is shown exactly once.
      assert.deepEqual(rounds, ['otp', 'password'])
      assert.equal(ws.prompts.length, 1)
      assert.match(ws.prompts[0].prompts[0].prompt, /verification code/i)
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('a label-less otp prompt (question in instructions) is not answered with the saved password', async () => {
    const rounds = []
    const server = await startServer(emptyLabelOtpAuth(rounds))
    const ws = createPromptWs(() => [OTP])

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
      assert.equal(ws.prompts.length, 1,
        'the otp dialog must be shown, not silently answered with the saved password')
      assert.match(ws.prompts[0].prompts[0].prompt, /mfa code/i,
        'the empty label is filled from the keyboard-interactive instructions')
      assert.deepEqual(rounds, ['password', 'otp'],
        'password first, then the code on the same connection')
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('takes back an MFA prompt when the connection dies under it', async () => {
    const server = await startServer(emptyLabelOtpAuth())
    // the dialog stays up and the user walks away: nothing ever answers it
    const ws = createUnansweredPromptWs()

    const attempt = session({
      host: '127.0.0.1',
      port: server.port,
      username: USERNAME,
      password: PASSWORD,
      useSshAgent: false,
      enableSsh: false,
      tabId: 'tab-mfa',
      readyTimeout: 5000
    }, ws).catch(e => e)

    // wait until the prompt is on screen, then drop the connection the way a
    // network loss during a 2FA login does
    for (let i = 0; i < 200 && !sentOf(ws, 'session-interactive').length; i++) {
      await delay(10)
    }
    await server.close()
    const err = await attempt

    assert.ok(err instanceof Error, 'an unanswered prompt must end the attempt')
    const prompts = sentOf(ws, 'session-interactive')
    const closes = sentOf(ws, 'session-interactive-close')
    assert.equal(prompts.length, 1, 'one attempt, one prompt - no retry loop')
    assert.equal(closes.length, 1, 'the dead prompt is taken back')
    assert.equal(closes[0].id, prompts[0].id, 'the close names the prompt it ends')
    assert.equal(closes[0].tabId, 'tab-mfa',
      'the close names the tab, so the renderer can stop reconnecting it')
  })

  test('a cancelled MFA prompt ends the attempt instead of asking again', async () => {
    const server = await startServer(emptyLabelOtpAuth())
    const ws = createPromptWs(() => [])

    let err
    try {
      await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        password: PASSWORD,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)
    } catch (e) {
      err = e
    } finally {
      await server.close()
    }

    assert.ok(err, 'cancelling the prompt must fail the connection')
    assert.match(err.message, /User cancel/)
    assert.equal(ws.prompts.length, 1,
      'a cancelled prompt must not be asked a second time')
  })

  test('a label-less password prompt is still answered with the saved password', async () => {
    const server = await startServer(emptyLabelPasswordAuth())
    const ws = createPromptWs(() => {
      throw new Error('a saved password should answer this prompt automatically')
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

      assert.ok(term, 'session should be created')
      assert.equal(ws.prompts.length, 0)
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

  test('prompts for an unknown host key once and records it in known_hosts', async () => {
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'host-verify-ed25519',
      type: 'ed25519',
      passphrase: ''
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
    const knownHostsPath = path.join(process.env.HOME, '.ssh', 'known_hosts')

    let term
    let firstPromptCount = 0
    try {
      const ws = createPromptWs((options, prompts) => {
        firstPromptCount = prompts.length
        assert.equal(options.mode, 'confirm')
        assert.match(options.name, /trust ssh host key/i)
        assert.match(options.instructions.join('\n'), /Fingerprint: SHA256:/)
        return ['trust']
      }, {
        includeConfirmPrompts: true
      })

      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKey: keyPair.privateKey,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws)

      assert.equal(firstPromptCount, 1)
      assert.match(fs.readFileSync(knownHostsPath, 'utf8'), /^\[127\.0\.0\.1\]:\d+ ssh-ed25519 /)
      term.kill()
      term = null

      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKey: keyPair.privateKey,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, createPromptWs(() => {
        throw new Error('known_hosts match should not prompt again')
      }))
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  test('waits for host trust confirmation before resolving the session', async () => {
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'host-verify-blocking-ed25519',
      type: 'ed25519',
      passphrase: ''
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))

    let term
    let pendingHandler
    let sessionResolved = false
    let promptSeenResolve
    const promptSeen = new Promise(resolve => {
      promptSeenResolve = resolve
    })
    const ws = {
      prompts: [],
      s (payload) {
        if (payload && payload.action === 'session-interactive') {
          this.prompts.push(payload.options)
          promptSeenResolve(payload.options)
        }
      },
      once (handler) {
        pendingHandler = handler
      },
      close () {}
    }

    try {
      const sessionPromise = session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKey: keyPair.privateKey,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000
      }, ws).then(result => {
        sessionResolved = true
        return result
      })

      const promptOptions = await promptSeen
      assert.equal(promptOptions.mode, 'confirm')
      await delay(50)
      assert.equal(sessionResolved, false)
      assert.equal(typeof pendingHandler, 'function')

      pendingHandler({
        results: ['trust']
      })
      term = await sessionPromise
    } finally {
      term && term.kill()
      await server.close()
    }
  })

  /**
   * The `debug` setting is only useful if it reaches the log: ssh2 writes its
   * protocol trace through log.log (level `info`), which a packaged build's
   * `warn` level drops, so session-ssh.js has to move the level as well as pass
   * the flag. ELECTERM_DEBUG is the process-visible half of that (the level
   * itself is pinned in log-debug-level.spec.js, where the packaged policy can
   * be exercised without NODE_ENV=production).
   */
  test('a debug session opens the log level for the ssh2 trace', async () => {
    const keyPair = generateClientKey({
      dir: tmpDir,
      name: 'debug-flag-ed25519',
      type: 'ed25519',
      passphrase: ''
    })
    const server = await startServer(publicKeyOnlyAuth(keyPair.publicKey))
    const ws = createPromptWs(() => {
      throw new Error('no prompt expected')
    })
    // keep the protocol trace out of the developer's real log file
    const originalResolvePath = log.transports.file.resolvePath
    const traceDir = makeTmpDir()
    log.transports.file.resolvePath = () => path.join(traceDir, 'main.log')
    const previous = process.env.ELECTERM_DEBUG
    let term
    try {
      term = await session({
        host: '127.0.0.1',
        port: server.port,
        username: USERNAME,
        privateKey: keyPair.privateKey,
        useSshAgent: false,
        enableSsh: false,
        readyTimeout: 5000,
        debug: true
      }, ws)

      assert.equal(process.env.ELECTERM_DEBUG, '1')
      const trace = fs.readFileSync(path.join(traceDir, 'main.log'), 'utf8')
      assert.match(trace, /Local ident/)
      assert.match(trace, /Remote ident/)
    } finally {
      term && term.kill()
      log.transports.file.resolvePath = originalResolvePath
      fs.rmSync(traceDir, { recursive: true, force: true })
      setEnvVar('ELECTERM_DEBUG', previous)
      await server.close()
    }
  })
})

/**
 * MFA / keyboard-interactive matrix for src/app/server/session-ssh.js.
 *
 * The server side of the login has to cope with every keyboard-interactive
 * shape a gateway can throw at it, and each shape fails in its own way when a
 * change touches the shared code path (auto-fill, 2FA detection, the retry
 * chain, prompt lifetime). This file is the inventory of those shapes: one
 * test per real-world login, asserting the contract the user sees -
 *
 *   - how many dialogs pop up, and with what labels (the dialog renders
 *     `prompts[].prompt`, so a blank label is a broken dialog for the user),
 *   - which string is answered to which prompt (the password in the code box
 *     burns the only attempt the server accepts),
 *   - how many logins reach the server (a 2FA retry is a whole extra login,
 *     counted by bastions and rate-limited),
 *   - whether the attempt ends with a session or with an error the user can
 *     act on.
 *
 * Shapes covered here (see the tests below for details):
 *
 *   1. keyboard-interactive only, password + code in one round
 *   2. keyboard-interactive only, code then password in two rounds
 *   3. password,keyboard-interactive with the SSH partial-success flag
 *   4. same login without the partial-success flag (the 2FA retry)
 *   5. label-less prompt, question in name/instructions (Aliyun gateway)
 *   6. custom keyword2FA, string form, and an emptied keyword2FA
 *   7. ignoreKeyboardInteractive (answer the password, leave the rest blank)
 *   8. interactiveValues (pre-filled answers, dialog never shown)
 *   9. isMFA bookmark (password field holds a one-time passcode)
 *  10. echo prompts in the same round as a hidden code
 *  11. Duo-style two-round menu
 *  12. a blank prompt with no hint at all (the password)
 *  13. password round first, code in a later round
 *  14. a mistyped code that is recoverable
 *  15. host key trust + MFA code on the same attempt
 *  16. a server that keeps refusing the code (bounded, no dialog loop)
 *  17. the user cancels the code dialog
 *
 * Not covered here on purpose: prompt lifetime (#4634, prompt taken back when
 * the connection dies) and the password re-prompt (#4646, #4670) live in
 * session-ssh.spec.js next to the rest of the retry-chain tests.
 */

process.env.NODE_ENV = 'development'

const { describe, test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
const { Server, utils } = require('@electerm/ssh2')
const { session } = require('../../../src/app/server/session-ssh')

const USERNAME = 'tester'
const PASSWORD = 'electerm-test'
const OTP = '123456'
// the one-line form: password and one-time code in a single answer (#4670)
const PASSCODE = `${PASSWORD} ${OTP}`

const HOST_KEY = utils.generateKeyPairSync('ed25519', {
  comment: 'electerm-mfa-host'
})

function makeTmpDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-mfa-test-'))
}

function setEnvVar (name, value) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

/**
 * An ssh2 server driven by a declarative auth shape.
 *
 * @param {object} shape
 * @param {string[]} [shape.advertise] methods offered at `none` and on failure
 * @param {object} [shape.password] how the `password` method behaves.
 *   `{ partial: true }` takes the password and keeps the connection for
 *   keyboard-interactive with the SSH partial-success flag (OpenSSH
 *   `AuthenticationMethods password,keyboard-interactive`).
 *   `{ keep: true }` takes the password but does not set the flag, which is
 *   what some closed-source gateways do: the client cannot tell the factors
 *   apart and has to fall back to keyboard-interactive alone.
 *   `{}` accepts the password outright (no second factor after it).
 * @param {Array} shape.rounds keyboard-interactive rounds, in order. Each one:
 *   `{ prompts, name, instructions, check(responses) }` where `check` returns
 *   `'accept'`, `'reject'` or `'next'` (ask the following round on the same
 *   connection).
 */
async function startServer (shape = {}) {
  const advertise = shape.advertise || ['keyboard-interactive']
  const rounds = shape.rounds || []
  const state = {
    // one per TCP login: a 2FA retry shows up here as an extra one
    logins: 0,
    // every auth method the client actually sent, in order
    methods: [],
    // every keyboard-interactive round the client answered
    rounds: [],
    // rounds the server refused
    rejected: []
  }
  const clients = new Set()
  const server = new Server({
    hostKeys: [HOST_KEY.private]
  }, (client) => {
    state.logins++
    clients.add(client)
    const cleanup = () => clients.delete(client)

    client.on('close', cleanup)
    client.on('end', cleanup)
    client.on('authentication', (ctx) => {
      if (ctx.method === 'none') {
        return ctx.reject(advertise)
      }
      state.methods.push(ctx.method)
      if (ctx.method === 'password') {
        if (shape.password && ctx.password === PASSWORD) {
          if (shape.password.partial) {
            return ctx.reject(['keyboard-interactive'], true)
          }
          if (shape.password.keep) {
            return ctx.reject(['keyboard-interactive'])
          }
          return ctx.accept()
        }
        return ctx.reject(advertise)
      }
      if (ctx.method !== 'keyboard-interactive') {
        return ctx.reject(advertise)
      }
      let index = 0
      const ask = () => {
        const round = rounds[index] || rounds[rounds.length - 1]
        index++
        ctx.prompt(
          round.prompts,
          round.name || 'electerm-test',
          round.instructions || '',
          (responses) => {
            state.rounds.push({
              name: round.name,
              labels: round.prompts.map(p => p.prompt),
              answers: responses
            })
            const verdict = round.check
              ? round.check(responses, state)
              : 'accept'
            if (verdict === 'accept') {
              return ctx.accept()
            }
            if (verdict === 'next' && index < rounds.length) {
              return ask()
            }
            state.rejected.push(responses)
            return ctx.reject(shape.rejectWith || advertise)
          }
        )
      }
      ask()
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
    state,
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

/**
 * The renderer stub. `prompts` holds every dialog the session asked for, in
 * order, with the host key trust prompt kept out of it (it is answered
 * automatically, exactly like the user clicking "Trust and Save") - the tests
 * that care about the trust dialog read `sent` instead.
 *
 * `answer(options, index)` returns the array the user typed, and `cancel`
 * answers as the cancel button.
 */
function createWs (opts = {}) {
  const {
    answer,
    cancel = false
  } = opts
  const sent = []
  const prompts = []
  const pending = new Map()
  return {
    sent,
    prompts,
    s (payload) {
      sent.push(payload)
      if (payload && payload.action === 'session-interactive') {
        pending.set(payload.id, payload.options)
        if (payload.options?.mode !== 'confirm') {
          prompts.push(payload.options)
        }
      }
    },
    once (handler, id) {
      const options = pending.get(id)
      pending.delete(id)
      if (options?.mode === 'confirm') {
        queueMicrotask(() => handler({ results: ['trust'] }))
        return () => {}
      }
      const index = Math.max(prompts.indexOf(options), 0)
      const results = cancel
        ? []
        : typeof answer === 'function'
          ? answer(options, index)
          : (answer || [])
      queueMicrotask(() => handler({ results }))
      return () => {}
    },
    close () {}
  }
}

function sentOf (ws, action) {
  return ws.sent.filter(d => d && d.action === action)
}

function labelsOf (ws, index) {
  return (ws.prompts[index]?.prompts || []).map(p => p.prompt)
}

let currentServer

async function runSession (server, extra = {}, wsOpts = {}) {
  currentServer = server
  const ws = createWs(wsOpts)
  let term
  let err
  try {
    term = await session({
      host: '127.0.0.1',
      port: server.port,
      username: USERNAME,
      useSshAgent: false,
      enableSsh: false,
      readyTimeout: 5000,
      ...extra
    }, ws)
  } catch (e) {
    err = e
  }
  return {
    ws,
    term,
    err,
    async done () {
      if (term) {
        term.kill()
      }
      await server.close()
    }
  }
}

describe('session-ssh MFA shapes', () => {
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

    // an empty ~/.ssh keeps keys (and their passphrase prompts) out of these
    // tests, and a fresh HOME means every server here is an unknown host key
    setEnvVar('HOME', homeDir)
    setEnvVar('USERPROFILE', homeDir)
    setEnvVar('SSH_AUTH_SOCK', undefined)
    setEnvVar('SSH_AGENT_PID', undefined)
    setEnvVar('sshKeysPath', sshKeysDir)
  })

  afterEach(async () => {
    if (currentServer) {
      await currentServer.close().catch(() => {})
      currentServer = null
    }
    setEnvVar('HOME', oldEnv.HOME)
    setEnvVar('USERPROFILE', oldEnv.USERPROFILE)
    setEnvVar('SSH_AUTH_SOCK', oldEnv.SSH_AUTH_SOCK)
    setEnvVar('SSH_AGENT_PID', oldEnv.SSH_AGENT_PID)
    setEnvVar('sshKeysPath', oldEnv.sshKeysPath)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('keyboard-interactive only: password and code in one round share one dialog', async () => {
    const server = await startServer({
      rounds: [{
        name: 'MFA required',
        prompts: [
          { prompt: 'Password:', echo: false },
          { prompt: 'Verification code:', echo: false }
        ],
        check: r => r[0] === PASSWORD && r[1] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: () => [PASSWORD, OTP]
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 1, 'both factors in one dialog')
      assert.deepEqual(labelsOf(r.ws, 0), ['Password:', 'Verification code:'],
        'the dialog shows both labels in the server order')
      assert.deepEqual(server.state.rounds[0].answers, [PASSWORD, OTP],
        'the password goes in the password box and the code in the code box')
      assert.equal(server.state.logins, 1,
        'keyboard-interactive is the only method offered: no 2FA reconnect')
    } finally {
      await r.done()
    }
  })

  test('keyboard-interactive only: code first, then password in a second round', async () => {
    const server = await startServer({
      rounds: [{
        prompts: [{ prompt: 'Verification code:', echo: false }],
        check: r => r[0] === OTP ? 'next' : 'reject'
      }, {
        prompts: [{ prompt: 'Password:', echo: false }],
        check: r => r[0] === PASSWORD ? 'accept' : 'reject'
      }]
    })
    // no saved password: both factors come from the user
    const r = await runSession(server, {}, {
      answer: (options, index) => index === 0 ? [OTP] : [PASSWORD]
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 2, 'one dialog per round')
      assert.deepEqual(labelsOf(r.ws, 0), ['Verification code:'])
      assert.deepEqual(labelsOf(r.ws, 1), ['Password:'])
      assert.equal(server.state.rounds.length, 2, 'both rounds on the same login')
      assert.equal(server.state.logins, 1, 'a second round is not a second login')
    } finally {
      await r.done()
    }
  })

  test('partial success: the code is answered on the connection that asked for it', async () => {
    // OpenSSH `AuthenticationMethods password,keyboard-interactive`: the
    // password is accepted, the connection stays, and the round asks for both
    // factors again. Hanging up here would strand a code bound to this
    // connection, so the dialog has to be shown on this one.
    const server = await startServer({
      advertise: ['password', 'keyboard-interactive'],
      password: { partial: true },
      rounds: [{
        name: 'Two-factor authentication',
        prompts: [
          { prompt: 'Password:', echo: false },
          { prompt: 'Verification code:', echo: false }
        ],
        check: r => r[0] === PASSWORD && r[1] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: () => [PASSWORD, OTP]
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.deepEqual(server.state.methods, ['password', 'keyboard-interactive'],
        'password first, then keyboard-interactive on the same login')
      assert.equal(server.state.logins, 1, 'no 2FA reconnect after a partial success')
      assert.equal(r.ws.prompts.length, 1, 'one dialog for the round')
      assert.deepEqual(server.state.rounds[0].answers, [PASSWORD, OTP])
    } finally {
      await r.done()
    }
  })

  test('no partial success: the password method is dropped and the login is retried', async () => {
    // Same login against a gateway that does not set the partial-success flag.
    // The only way keyboard-interactive can be handed both factors is to
    // reconnect without the password method, so this costs one extra login and
    // the dialog is asked again on the new connection.
    const server = await startServer({
      advertise: ['password', 'keyboard-interactive'],
      // takes the password, but does not flag the connection as partially
      // authenticated, so electerm cannot tell the factors apart
      password: { keep: true },
      rejectWith: ['keyboard-interactive'],
      rounds: [{
        name: 'Two-factor authentication',
        prompts: [
          { prompt: 'Password:', echo: false },
          { prompt: 'Verification code:', echo: false }
        ],
        check: r => r[0] === PASSWORD && r[1] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: () => [PASSWORD, OTP]
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.deepEqual(server.state.methods, [
        'password',
        'keyboard-interactive',
        'keyboard-interactive'
      ], 'the retry sends keyboard-interactive alone')
      assert.equal(server.state.logins, 2,
        'a 2FA retry is a full extra login - bastions count and rate-limit it')
      assert.equal(r.ws.prompts.length, 1,
        'the dialog belongs to the second login, the first one never shows it')
      assert.deepEqual(server.state.rounds[0].answers, [PASSWORD, OTP])
      assert.deepEqual(server.state.rejected, [],
        'the code is answered once, on the connection that accepted it')
    } finally {
      await r.done()
    }
  })

  test('a label-less prompt takes the question from name/instructions', async () => {
    // Aliyun gateway: the prompt label is empty, the question is in the
    // instructions, and the hidden box is the SMS code, not the password.
    const server = await startServer({
      advertise: ['password', 'keyboard-interactive'],
      password: { keep: true },
      rounds: [{
        name: 'Two-Step Verification required',
        instructions: 'Please Input Mfa Code (SMS)',
        prompts: [{ prompt: '', echo: false }],
        check: r => r[0] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: () => [OTP]
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 1,
        'the code dialog must be shown, not answered with the saved password')
      assert.deepEqual(labelsOf(r.ws, 0), ['Please Input Mfa Code (SMS)'],
        'the empty label is filled from the instructions')
      assert.equal(r.ws.prompts[0].name, 'Two-Step Verification required')
      assert.deepEqual(r.ws.prompts[0].instructions, [],
        'a string instructions field is normalized, the dialog indexes it per prompt')
      assert.deepEqual(server.state.rounds[0].answers, [OTP])
    } finally {
      await r.done()
    }
  })

  test('custom keyword2FA (string form) detects a non-default second factor', async () => {
    // a bastion asking for a token that no default keyword covers: without the
    // custom list the blank prompt looks like a password prompt and gets the
    // saved password filled in, burning the only answer the server accepts
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        name: 'Gateway',
        instructions: 'Please enter your access token',
        prompts: [{ prompt: '', echo: false }],
        check: r => r[0] === '987654' ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, {
      password: PASSWORD,
      keyword2FA: 'verification code,access token'
    }, {
      answer: () => ['987654']
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 1, 'the token prompt is shown')
      assert.deepEqual(labelsOf(r.ws, 0), ['Please enter your access token'])
      assert.deepEqual(server.state.rounds[0].answers, ['987654'])
    } finally {
      await r.done()
    }
  })

  test('custom keyword2FA also accepts the array form from a profile', async () => {
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        name: 'Gateway',
        instructions: 'Please enter your access token',
        prompts: [{ prompt: '', echo: false }],
        check: r => r[0] === '987654' ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, {
      password: PASSWORD,
      keyword2FA: ['access token']
    }, {
      answer: () => ['987654']
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 1, 'the token prompt is shown')
      assert.deepEqual(server.state.rounds[0].answers, ['987654'])
    } finally {
      await r.done()
    }
  })

  test('an emptied keyword2FA falls back to the built-in keywords', async () => {
    // the setting is a free-text field: clearing it must not turn MFA
    // detection off for every gateway that uses the default wording
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        name: 'Two-Step Verification required',
        instructions: 'Please Input Mfa Code (SMS)',
        prompts: [{ prompt: '', echo: false }],
        check: r => r[0] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD, keyword2FA: '' }, {
      answer: () => [OTP]
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 1,
        'with an empty keyword2FA the default keywords still catch the code prompt')
      assert.deepEqual(server.state.rounds[0].answers, [OTP])
    } finally {
      await r.done()
    }
  })

  test('ignoreKeyboardInteractive answers the password and leaves the rest blank', async () => {
    // for gateways that ask for the password through keyboard-interactive and
    // add a factor the user does not have: configured to answer silently
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        name: 'Login',
        prompts: [
          { prompt: 'Password:', echo: false },
          { prompt: 'PIN (optional):', echo: false }
        ],
        check: r => r[0] === PASSWORD && r[1] === '' ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, {
      password: PASSWORD,
      ignoreKeyboardInteractive: true
    }, {
      answer: () => {
        throw new Error('ignoreKeyboardInteractive must never show a dialog')
      }
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 0, 'no dialog at all')
      assert.equal(server.state.logins, 1)
      assert.deepEqual(server.state.rounds[0].answers, [PASSWORD, ''],
        'the password answers the first prompt, every later one is empty')
    } finally {
      await r.done()
    }
  })

  test('interactiveValues answers every prompt without a dialog', async () => {
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        name: 'MFA required',
        prompts: [
          { prompt: 'Password:', echo: false },
          { prompt: 'Verification code:', echo: false }
        ],
        check: r => r[0] === PASSWORD && r[1] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, {
      interactiveValues: `${PASSWORD}\n${OTP}`
    }, {
      answer: () => {
        throw new Error('interactiveValues must never show a dialog')
      }
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 0, 'no dialog at all')
      assert.deepEqual(server.state.rounds[0].answers, [PASSWORD, OTP],
        'the values are used in order, one per prompt')
    } finally {
      await r.done()
    }
  })

  test('interactiveValues never answers the host key trust dialog', async () => {
    // the pre-filled answers are for the server's questions only: the host key
    // decision is a security prompt and has to reach the user
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        prompts: [{ prompt: 'Verification code:', echo: false }],
        check: r => r[0] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, {
      password: PASSWORD,
      interactiveValues: OTP
    })

    try {
      assert.ok(r.term, 'session should be created')
      const prompts = sentOf(r.ws, 'session-interactive')
      assert.equal(prompts.length, 1, 'only the trust prompt was sent')
      assert.equal(prompts[0].options.mode, 'confirm',
        'the trust dialog is still a confirm prompt, not pre-answered')
      assert.equal(r.ws.prompts.length, 0, 'no MFA dialog: the value answered it')
      assert.deepEqual(server.state.rounds[0].answers, [OTP])
    } finally {
      await r.done()
    }
  })

  test('isMFA bookmark: the saved passcode answers keyboard-interactive, password auth is skipped', async () => {
    // the "MFA/OTP" switch: what is saved in the password field is a one-time
    // passcode, so sending it as the `password` method would spend it before
    // keyboard-interactive can use it
    const server = await startServer({
      advertise: ['password', 'keyboard-interactive'],
      rounds: [{
        name: 'MFA required',
        prompts: [{ prompt: 'Password (password + verification code):', echo: false }],
        check: r => r[0] === PASSCODE ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, {
      password: PASSCODE,
      isMFA: true
    }, {
      answer: () => {
        throw new Error('the saved passcode should answer this prompt automatically')
      }
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.deepEqual(server.state.methods, ['keyboard-interactive'],
        'the password method must not be attempted with a passcode')
      assert.equal(r.ws.prompts.length, 0, 'the saved passcode answers it')
      assert.deepEqual(server.state.rounds[0].answers, [PASSCODE])
      assert.equal(server.state.logins, 1)
    } finally {
      await r.done()
    }
  })

  test('an echo prompt is shown next to the hidden code and keeps its echo flag', async () => {
    // SSH key + a visible account selector + a hidden code: echo is not a
    // synonym for "not a secret", and an echo prompt must never be auto-filled
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        name: 'Login',
        prompts: [
          { prompt: 'Account:', echo: true },
          { prompt: 'Verification code:', echo: false }
        ],
        check: r => r[0] === 'shared' && r[1] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: () => ['shared', OTP]
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 1)
      assert.deepEqual(labelsOf(r.ws, 0), ['Account:', 'Verification code:'])
      assert.deepEqual(r.ws.prompts[0].prompts.map(p => p.echo), [true, false],
        'the dialog needs the echo flag to hide only the code')
      assert.deepEqual(server.state.rounds[0].answers, ['shared', OTP],
        'no auto-fill on a visible prompt')
    } finally {
      await r.done()
    }
  })

  test('a Duo-style menu answers one round per step', async () => {
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        prompts: [{ prompt: 'Passcode or option (1-2):', echo: false }],
        check: r => r[0] === '1' ? 'next' : 'reject'
      }, {
        prompts: [{ prompt: 'Press 1 to send a push, or enter a passcode:', echo: false }],
        check: r => r[0] === '1' ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, {}, {
      answer: (options, index) => index === 0 ? ['1'] : ['1']
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 2, 'one dialog per menu step')
      assert.deepEqual(labelsOf(r.ws, 0), ['Passcode or option (1-2):'])
      assert.deepEqual(labelsOf(r.ws, 1), ['Press 1 to send a push, or enter a passcode:'])
      assert.equal(server.state.logins, 1)
    } finally {
      await r.done()
    }
  })

  test('a blank prompt with no hint at all is the password', async () => {
    // the plainest legacy gateway: one hidden prompt, no label, no name, no
    // instructions. Only a saved password can answer this one silently.
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        prompts: [{ prompt: '', echo: false }],
        check: r => r[0] === PASSWORD ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: () => {
        throw new Error('a blank prompt with no 2FA hint is the password')
      }
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 0, 'answered from the saved password')
      assert.deepEqual(server.state.rounds[0].answers, [PASSWORD])
    } finally {
      await r.done()
    }
  })

  test('password first, code in a later round: only the code is asked', async () => {
    // F5 / Citrix style: the password round comes first and is answered from
    // the saved password, the code round follows on the same connection
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        prompts: [{ prompt: 'Password:', echo: false }],
        check: r => r[0] === PASSWORD ? 'next' : 'reject'
      }, {
        prompts: [{ prompt: 'Verification code:', echo: false }],
        check: r => r[0] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: () => [OTP]
    })

    try {
      assert.ok(r.term, 'session should be created')
      assert.equal(r.ws.prompts.length, 1, 'only the code needs the user')
      assert.deepEqual(labelsOf(r.ws, 0), ['Verification code:'])
      assert.deepEqual(server.state.rounds.map(round => round.answers),
        [[PASSWORD], [OTP]],
        'the saved password still answers the password round')
      assert.equal(server.state.logins, 1)
    } finally {
      await r.done()
    }
  })

  test('a mistyped code is recoverable', async () => {
    // the code the user typed is wrong, not the password: the login has to end
    // up connected on a later attempt instead of dead-ending
    const server = await startServer({
      advertise: ['password', 'keyboard-interactive'],
      password: { keep: true },
      rounds: [{
        name: 'MFA required',
        prompts: [{ prompt: 'Verification code:', echo: false }],
        check: r => r[0] === OTP ? 'accept' : 'reject'
      }]
    })
    let codes = 0
    const r = await runSession(server, { password: PASSWORD }, {
      answer: (options) => {
        const label = (options.prompts[0].prompt || '').toLowerCase()
        if (label.includes('verification code')) {
          return [codes++ === 0 ? '000000' : OTP]
        }
        // the retry chain asks for the password after a failed attempt
        return [PASSWORD]
      }
    })

    try {
      assert.ok(r.term, 'the retry with the right code must connect')
      assert.deepEqual(server.state.rejected, [['000000']],
        'the mistyped code is what the server refused')
      assert.deepEqual(r.ws.prompts.map(p => p.prompts[0].prompt), [
        'Verification code:',
        // the rejected attempt sends the retry chain's password prompt first,
        // so a typo costs one extra dialog before the code is asked again
        'password',
        'Verification code:'
      ], 'a typo costs a password prompt, then the code again')
      assert.equal(server.state.rounds[server.state.rounds.length - 1].answers[0], OTP)
    } finally {
      await r.done()
    }
  })

  test('the host key trust dialog comes before the code dialog', async () => {
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        name: 'MFA required',
        prompts: [{ prompt: 'Verification code:', echo: false }],
        check: r => r[0] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: () => [OTP]
    })

    try {
      assert.ok(r.term, 'session should be created')
      const prompts = sentOf(r.ws, 'session-interactive')
      assert.equal(prompts.length, 2, 'trust, then the code')
      assert.equal(prompts[0].options.mode, 'confirm', 'the host is unknown')
      assert.equal(prompts[1].options.mode, undefined, 'then the MFA prompt')
      assert.deepEqual(labelsOf(r.ws, 0), ['Verification code:'])
      assert.deepEqual(server.state.rounds[0].answers, [OTP])
      assert.equal(server.state.logins, 1,
        'the trust decision does not cost a login or a re-prompt')
    } finally {
      await r.done()
    }
  })

  test('a server that keeps refusing the code ends the attempt instead of looping', async () => {
    // nothing here can succeed, so the point is that the login stops: a finite
    // number of dialogs, a finite number of logins, and a real error message
    const server = await startServer({
      advertise: ['password', 'keyboard-interactive'],
      rounds: [{
        name: 'MFA required',
        prompts: [{ prompt: 'Verification code:', echo: false }],
        check: () => 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      answer: (options) => ['000000']
    })

    try {
      assert.ok(r.err, 'the connection must fail')
      assert.match(r.err.message, /All configured authentication methods failed/)
      // one code dialog per attempt, plus the one password re-prompt the
      // retry chain allows - the point is that the count is bounded, not zero
      assert.ok(r.ws.prompts.length <= 3,
        `the dialog must not loop, got ${r.ws.prompts.length} of them`)
      assert.ok(server.state.logins <= 2,
        `the auth failure must not retry forever, got ${server.state.logins} logins`)
    } finally {
      await r.done()
    }
  })

  test('cancelling the code dialog ends the attempt without another one', async () => {
    const server = await startServer({
      advertise: ['keyboard-interactive'],
      rounds: [{
        name: 'MFA required',
        prompts: [{ prompt: 'Verification code:', echo: false }],
        check: r => r[0] === OTP ? 'accept' : 'reject'
      }]
    })
    const r = await runSession(server, { password: PASSWORD }, {
      cancel: true
    })

    try {
      assert.ok(r.err, 'cancelling the prompt must fail the connection')
      assert.match(r.err.message, /User cancel/)
      assert.equal(r.ws.prompts.length, 1, 'a cancelled prompt is not asked again')
      assert.equal(server.state.logins, 1, 'and no new login is started for it')
    } finally {
      await r.done()
    }
  })
})

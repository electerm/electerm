const fs = require('fs')
const path = require('path')
const log = require('../../common/log')
const { algAlt, canRetryWithAltAlgorithms } = require('../ssh2-alg')
const { Client } = require('@electerm/ssh2')
const proxySock = require('../socks')
const { maybeProxyCommand } = require('../ssh-proxy-command')
const { buildConnectOptions, isIdentityPublicKey } = require('./options')
const { credentialPrompt } = require('./prompts')
const { handshake } = require('./handshake')

function proxyMessage (session, text) {
  log.log('ssh proxy command:', text.trim())
  const url = text.match(/https?:\/\/\S+/)
  if (url && session.ws && !session.proxyCommandUrlShown) {
    session.proxyCommandUrlShown = true
    session.ws.s({
      action: 'ssh-proxy-command-message',
      message: text.trim(),
      url: url[0],
      tabId: session.initOptions.srcTabId
    })
  }
}

async function openTransport (session, options, { target, upstream }) {
  if (upstream) {
    return new Promise((resolve, reject) => {
      upstream.forwardOut('127.0.0.1', 0, target.host, target.port, (err, socket) => {
        if (err) reject(err)
        else resolve({ socket })
      })
    })
  }
  const { initOptions } = session
  if (initOptions.proxy) {
    return proxySock({ ...target, proxy: initOptions.proxy, readyTimeout: initOptions.readyTimeout })
  }
  if (!initOptions.connectionHoppings?.length) {
    return maybeProxyCommand(initOptions, options, { onMessage: text => proxyMessage(session, text) })
  }
}

async function connectAttempt (session, options, settings) {
  const transport = await openTransport(session, options, settings)
  const conn = new Client()
  session.nextConn = conn
  try {
    const config = { ...options }
    if (transport?.socket) {
      delete config.host
      delete config.port
      config.sock = transport.socket
    }
    await handshake(session, conn, config, settings.target, {
      ...settings,
      // The proxy command serves its own SSH endpoint. An ordinary proxy or
      // forwarded socket still verifies the original host and port.
      skipHostVerification: !!transport?.dispose
    })
    if (transport?.dispose) session.proxyCommandDispose = transport.dispose
    return conn
  } catch (err) {
    conn.end()
    // Key parsing can fail before ssh2 takes ownership of the socket.
    transport?.socket?.destroy()
    transport?.dispose?.()
    throw err
  } finally {
    session.nextConn = null
  }
}

async function connectWithCredentials (session, credentials, {
  target, upstream, keyName, forwardX11, keyboardOnly = false
}) {
  const options = { ...credentials }
  const settings = { target, upstream, forwardX11, savedPassword: options.password, allowMfaRetry: !keyboardOnly }
  if (keyboardOnly) delete options.password
  if (!upstream) {
    if (session.altAlg) options.algorithms = algAlt()
    session.connectOptions = options
  }
  let askedPassphrase = false
  while (true) {
    try {
      return await connectAttempt(session, options, settings)
    } catch (err) {
      if (session.prompts.aborted || typeof err?.message !== 'string') throw err
      if (!upstream && !session.altAlg && canRetryWithAltAlgorithms(err)) {
        session.altAlg = true
        options.algorithms = algAlt()
      } else if (settings.allowMfaRetry && err.message === '2FA_RETRY') {
        settings.allowMfaRetry = false
        delete options.password
      } else if (!askedPassphrase && err.message.includes('passphrase')) {
        askedPassphrase = true
        const prompt = credentialPrompt(`passphrase for ${keyName || 'privateKey'}`, 'passphrase')
        const [answer] = await session.prompts.ask(prompt, null, upstream)
        if (!answer) throw err
        options.passphrase = answer
      } else {
        throw err
      }
    }
  }
}

function * localCredentials (options) {
  const dir = process.env.sshKeysPath
  if (dir && !options.privateKey && !options.password) {
    let files = []
    try {
      files = fs.readdirSync(dir)
    } catch (err) {
      log.warn('could not list local SSH keys', err.message)
    }
    for (const file of files.filter(isIdentityPublicKey)) {
      const keyName = path.join(dir, file.slice(0, -4))
      try {
        const privateKey = fs.readFileSync(keyName, 'utf8')
        yield { options: { ...options, privateKey }, keyName }
      } catch (err) {
        log.warn('could not read local SSH key', keyName, err.message)
      }
    }
  }
  yield { options, keyName: options.privateKeyPath }
}

async function connectEndpoint (session, base, candidates, settings) {
  const { target, upstream } = settings
  let lastError
  for await (const { options, keyName } of candidates) {
    try {
      return await connectWithCredentials(session, options, { ...settings, keyName })
    } catch (err) {
      if (session.prompts.aborted || typeof err?.message !== 'string') throw err
      if (options !== base && err.message.includes('passphrase')) continue
      if (!err.message.includes('All configured authentication methods failed')) throw err
      lastError = err
    }
  }

  // A jump host with explicit credentials reports its authentication error.
  if (upstream && (base.password || base.privateKey)) throw lastError
  // Ask once after exhausting the available credentials. A rejected saved
  // password can contain a spent OTP, so only a fresh answer can be retried.
  const prompt = credentialPrompt(`password for ${base.username}@${target.host}`, 'password')
  const [password] = await session.prompts.ask(prompt, null, upstream)
  if (!password) throw lastError
  return connectWithCredentials(session, { ...base, password }, { ...settings, keyName: base.privateKeyPath })
}

async function connectFirst (session) {
  const { initOptions } = session
  const base = buildConnectOptions(initOptions)
  if (!base.username) {
    const [username] = await session.prompts.ask(credentialPrompt('username', 'username', true))
    if (!username) throw new Error('An SSH username is required')
    base.username = username
  }
  return connectEndpoint(session, base, localCredentials(base), {
    target: { host: base.host, port: base.port || 22 },
    forwardX11: !initOptions.connectionHoppings?.length,
    keyboardOnly: !!initOptions.isMFA
  })
}

module.exports = { connectFirst, connectEndpoint }

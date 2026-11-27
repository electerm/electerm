const { createHostVerifier } = require('../ssh-known-hosts')
const { isLikely2FAPrompts } = require('./prompts')
const { forwardX11Channel } = require('../x11')

function authOrder (options) {
  const methods = ['none']
  if (options.password !== undefined) methods.push('password')
  if (options.privateKey !== undefined) methods.push('publickey')
  if (options.agent !== undefined) methods.push('agent')
  if (options.tryKeyboard) methods.push('keyboard-interactive')
  if (options.privateKey !== undefined &&
      options.localHostname !== undefined && options.localUsername !== undefined) {
    methods.push('hostbased')
  }
  return methods
}

// ssh2 asks for the next method after each rejection. Partial success starts a
// new authentication stage, so methods already tried can be offered again.
function authentication (options) {
  const methods = authOrder(options)
  const attempted = new Set()
  let passwordAttempted = false
  let partiallyAuthenticated = false
  return {
    nextMethod (allowed, partialSuccess) {
      if (partialSuccess) {
        partiallyAuthenticated = true
        attempted.clear()
      }
      const offered = allowed?.length ? allowed : methods
      const next = methods.find(method =>
        !attempted.has(method) &&
        (offered.includes(method) || (method === 'agent' && offered.includes('publickey')))
      )
      if (!next) return false
      attempted.add(next)
      if (next === 'password') passwordAttempted = true
      return next
    },

    // Only restart a combined password/code exchange when we sent the password
    // method and it failed outright. A code-only challenge belongs to this login.
    shouldRetryWithoutPassword (prompts, keywords) {
      return passwordAttempted && !partiallyAuthenticated && options.password &&
        isLikely2FAPrompts(prompts, keywords) &&
        prompts.some(p => !p.echo && (p.prompt || '').toLowerCase().includes('password'))
    }
  }
}

function handshake (session, conn, connectOptions, target, {
  forwardX11, savedPassword, skipHostVerification, allowMfaRetry
}) {
  const { ignoreKeyboardInteractive, keyword2FA, x11 } = session.initOptions
  const auth = authentication(connectOptions)
  const options = { ...connectOptions, authHandler: auth.nextMethod }
  let verificationError
  let disconnected = false
  if (skipHostVerification && options.sock) {
    delete options.hostVerifier
  } else {
    options.hostVerifier = createHostVerifier({
      ...target,
      async confirm (prompt) {
        // Reading known_hosts is asynchronous. The transport may have closed
        // before the verifier discovers that it needs to ask for confirmation.
        if (disconnected) return false
        const results = await session.prompts.ask(prompt, undefined, conn)
        return !disconnected && results?.[0] === (prompt.confirmResult || 'trust')
      },
      onError (err) { verificationError = err }
    })
  }

  async function answerKeyboard (name, instructions, instructionsLang, prompts, finish) {
    if (disconnected) return
    if (ignoreKeyboardInteractive) {
      return finish((prompts || []).map((_, i) => i === 0 ? (options.password || '') : ''))
    }
    if (allowMfaRetry && auth.shouldRetryWithoutPassword(prompts, keyword2FA)) {
      throw new Error('2FA_RETRY')
    }
    const prompt = { name, instructions, instructionsLang, prompts }
    const answers = await session.prompts.ask(prompt, savedPassword, conn)
    if (!disconnected) finish(answers)
  }

  return new Promise((resolve, reject) => {
    function fail (err) {
      disconnected = true
      session.prompts.abort(conn)
      reject(verificationError || err)
    }
    conn.on('keyboard-interactive', (...args) => answerKeyboard(...args).catch(fail))
    if (forwardX11 && x11 === true) {
      conn.on('x11', (info, accept, reject) => forwardX11Channel(session, conn, accept, reject))
    }
    conn.once('ready', () => resolve(true))
    conn.on('error', fail)
    conn.once('close', () => fail(new Error('SSH connection closed before it was ready')))
    conn.connect(options)
  })
}

module.exports = { handshake }

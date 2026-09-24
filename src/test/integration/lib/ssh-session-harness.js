/**
 * Shared bits for specs that drive a real TerminalSsh session() against the
 * in-process ssh2 test server (lib/ssh-test-server.js):
 *   - createTrustingWs(): a ws stub that auto-answers the interactive prompts
 *     session() sends over the websocket (host-key confirmation, passwords)
 *   - waitFor(): poll a condition until it holds, so a spec never relies on a
 *     fixed sleep
 *
 * Specs are expected to point HOME at a throwaway dir before requiring the
 * app code: with a fresh known_hosts every test server is an unknown host and
 * the host-key prompt above decides what happens (the stub trusts).
 */

/**
 * Minimal ws stub for session(): answers host-key confirmations with "trust"
 * and any other prompt with an empty answer, so a prompt can never hang the
 * run.
 */
function createTrustingWs () {
  let pending
  const prompts = []
  return {
    prompts,
    s (payload) {
      if (payload && payload.action === 'session-interactive') {
        pending = payload.options
        prompts.push(payload.options)
      }
    },
    once (handler) {
      const options = pending
      queueMicrotask(() => {
        handler({
          results: options && options.mode === 'confirm'
            ? ['trust']
            : ['']
        })
      })
    },
    close () {}
  }
}

/**
 * Poll `cond` until it returns truthy.
 * @param {Function} cond
 * @param {number} timeout
 * @param {number} interval
 * @returns {Promise<boolean>} resolves true, rejects on timeout
 */
function waitFor (cond, timeout = 5000, interval = 50) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      let ok = false
      try {
        ok = !!cond()
      } catch (_) {
        ok = false
      }
      if (ok) {
        return resolve(true)
      }
      if (Date.now() - start > timeout) {
        return reject(new Error(`condition not met within ${timeout}ms`))
      }
      setTimeout(tick, interval)
    }
    tick()
  })
}

module.exports = {
  createTrustingWs,
  waitFor
}

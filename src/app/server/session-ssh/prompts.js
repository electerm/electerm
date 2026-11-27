const generate = require('../../common/uid')
const { isEmpty, pick } = require('../../lib/lodash')

const defaultKeywords = [
  'verification code', 'otp', 'one-time', 'two-factor', '2fa', 'totp',
  'authenticator', 'duo', 'yubikey', 'security code', 'mfa', 'passcode'
]

function isLikely2FAPrompts (prompts, keyword2FA) {
  const configured = Array.isArray(keyword2FA) ? keyword2FA : String(keyword2FA || '').split(/[,\n]/)
  const keywords = configured.map(s => String(s).trim().toLowerCase()).filter(Boolean)
  const matches = keywords.length ? keywords : defaultKeywords
  return (prompts || []).some(({ prompt }) => {
    const label = (prompt || '').toLowerCase()
    return matches.some(word => label.includes(word))
  })
}

function passwordPrompt ({ prompts, name, instructions }, keyword2FA) {
  if (prompts?.length !== 1 || prompts[0].echo) return false
  const label = (prompts[0].prompt || '').trim().toLowerCase()
  if (label) return label.includes('password')
  // Gateways sometimes put the OTP question entirely in the instructions.
  const hints = [name].concat(instructions || []).map(prompt => ({ prompt }))
  return !isLikely2FAPrompts(hints, keyword2FA)
}

function labelBarePrompts (options) {
  const { prompts, name, instructions } = options
  if (!prompts?.some(p => !p.prompt)) return options
  const hint = (Array.isArray(instructions) ? instructions.join(' ') : String(instructions || '')).trim() || name || ''
  return {
    ...options,
    instructions: Array.isArray(instructions) ? instructions : [],
    prompts: prompts.map(p => p.prompt ? p : { ...p, prompt: hint })
  }
}

function credentialPrompt (name, prompt, echo = false) {
  return { name, instructions: [''], prompts: [{ prompt, echo }] }
}

class InteractivePrompts {
  constructor (session) {
    this.session = session
    this.pending = new Map()
    this.closedConnections = new WeakSet()
    // Both retry loops stop for the rest of the session if a user cancels or
    // a connection dies with an unanswered prompt. Losing a connection with
    // no pending prompt of its own leaves credential and algorithm retries available.
    this.aborted = false
  }

  async ask (options, savedPassword, owner) {
    if (owner && this.closedConnections.has(owner)) throw new Error('SSH connection closed before the prompt')
    const { initOptions, ws } = this.session
    if (options.mode !== 'confirm') {
      if (initOptions.interactiveValues) return initOptions.interactiveValues.split('\n')
      if (savedPassword && passwordPrompt(options, initOptions.keyword2FA)) {
        return [savedPassword]
      }
    }
    if (!ws) throw new Error('SSH authentication requires an interactive prompt')

    const id = generate()
    const { tabId } = initOptions
    ws.s({
      id,
      action: 'session-interactive',
      ...pick(initOptions, ['interactiveValues', 'tabId']),
      options: labelBarePrompts(options)
    })
    return new Promise((resolve, reject) => {
      const pending = {
        owner,
        abort: (reason) => {
          this.pending.delete(id)
          pending.dispose?.()
          ws.s({ action: 'session-interactive-close', id, tabId })
          reject(reason)
        }
      }
      this.pending.set(id, pending)
      pending.dispose = ws.once(({ results }) => {
        this.pending.delete(id)
        if (isEmpty(results)) {
          this.aborted = true
          reject(new Error('User cancel'))
        } else {
          resolve(results)
        }
      }, id)
    })
  }

  // A handshake owns its host-key and MFA prompts. A retry's password prompt
  // must survive the previous client's delayed close (#4646).
  abort (owner, reason) {
    if (owner) this.closedConnections.add(owner)
    for (const prompt of this.pending.values()) {
      if (!owner || prompt.owner === owner) {
        this.aborted = true
        prompt.abort(reason || new Error('SSH session closed'))
      }
    }
  }
}

module.exports = { InteractivePrompts, credentialPrompt, isLikely2FAPrompts }

// Declarative auto-responder engine (ZOC ZocRespond style).
// Watches a decoded text stream, matches enabled trigger rules and
// fires their send actions. Trigger rules shape:
// {
//   id, name, enabled,
//   match: { type: 'text' | 'regex', value, caseSensitive },
//   action: { type: 'send', value },
//   sendEnter, mode: 'repeat' | 'once' | 'cooldown', cooldownMs
// }
import { stripAnsi, normalizeCR } from './strip-ansi.js'
import { escapeRegExp, expandControlChars } from './keys.js'

function buildRegExp (rule) {
  const { type = 'text', value = '', caseSensitive = false } = rule.match || {}
  if (!value) {
    return null
  }
  try {
    if (type === 'regex') {
      return new RegExp(value, caseSensitive ? '' : 'i')
    }
    return new RegExp(escapeRegExp(value), caseSensitive ? '' : 'i')
  } catch (e) {
    return null
  }
}

export function validateTriggers (list) {
  const errors = []
  if (!Array.isArray(list)) {
    return ['triggers must be an array']
  }
  list.forEach((t, i) => {
    if (!t || typeof t !== 'object') {
      errors.push(`#${i}: must be an object`)
      return
    }
    if (!t.match || !t.match.value) {
      errors.push(`#${i} (${t.name || 'unnamed'}): match.value required`)
    } else if (t.match.type === 'regex') {
      try {
        // eslint-disable-next-line no-new
        new RegExp(t.match.value)
      } catch (e) {
        errors.push(`#${i} (${t.name || 'unnamed'}): invalid regex: ${e.message}`)
      }
    }
    if (t.mode && !['repeat', 'once', 'cooldown'].includes(t.mode)) {
      errors.push(`#${i} (${t.name || 'unnamed'}): bad mode ${t.mode}`)
    }
  })
  return errors
}

export default class TriggerEngine {
  constructor ({ send, maxBuffer = 65536, onFire = null, now = Date.now } = {}) {
    this.send = send
    this.maxBuffer = maxBuffer
    this.onFire = onFire
    this.now = now
    this.buf = ''
    this.base = 0
    this.rules = []
    this.reCache = new Map()
    this.ruleState = new Map()
  }

  setTriggers (rules) {
    const nextRules = Array.isArray(rules) ? rules.filter(Boolean) : []
    const streamEnd = this.base + this.buf.length
    const nextState = new Map()
    nextRules.forEach((rule, index) => {
      const key = this._getRuleKey(rule, index)
      const signature = this._getRuleSignature(rule)
      const previous = this.ruleState.get(key)
      nextState.set(key, previous?.signature === signature
        ? previous
        : {
            signature,
            startAt: streamEnd,
            seenEnd: streamEnd,
            consumedEnd: streamEnd,
            lastFire: 0,
            firedOnce: false
          })
    })
    this.rules = nextRules
    this.ruleState = nextState
    this.reCache.clear()
  }

  resetOnce (id = null) {
    for (const [key, state] of this.ruleState) {
      if (id == null || key === id) {
        state.firedOnce = false
      }
    }
  }

  _getRuleKey (rule, index) {
    return rule.id || `#${index}`
  }

  _getRuleSignature (rule) {
    return JSON.stringify([
      rule.enabled,
      rule.match?.type,
      rule.match?.value,
      rule.match?.caseSensitive,
      rule.action?.type,
      rule.action?.value,
      rule.sendEnter,
      rule.mode,
      rule.cooldownMs
    ])
  }

  _getRe (rule) {
    const key = rule.id + '#' + (rule.match?.type || 'text') + '#' + (rule.match?.value || '') + '#' + (rule.match?.caseSensitive ? 's' : 'i')
    if (!this.reCache.has(key)) {
      this.reCache.set(key, buildRegExp(rule))
    }
    return this.reCache.get(key)
  }

  push (raw) {
    if (!raw) {
      return
    }
    const str = normalizeCR(stripAnsi(raw))
    if (!str) {
      return
    }
    this.buf += str
    if (this.buf.length > this.maxBuffer) {
      const over = this.buf.length - this.maxBuffer
      this.buf = this.buf.slice(over)
      this.base += over
    }
    this._scan()
  }

  _scan () {
    const now = this.now()
    const streamEnd = this.base + this.buf.length
    this.rules.forEach((rule, index) => {
      if (!rule || rule.enabled === false) {
        return
      }
      const state = this.ruleState.get(this._getRuleKey(rule, index))
      if (!state) {
        return
      }
      const mode = rule.mode || 'cooldown'
      if (mode === 'once' && state.firedOnce) {
        state.seenEnd = streamEnd
        return
      }
      const re = this._getRe(rule)
      if (!re) {
        state.seenEnd = streamEnd
        return
      }
      const gre = new RegExp(re.source, re.flags.includes('i') ? 'gi' : 'g')
      const previousEnd = state.seenEnd
      // Literal matches only need enough overlap to bridge the latest chunk.
      // Regexes can have arbitrary width, so scan the retained window and use
      // absolute stream positions below to ignore matches already observed.
      if (rule.match?.type !== 'regex') {
        const overlap = Math.max(0, (rule.match?.value || '').length - 1)
        gre.lastIndex = Math.max(0, previousEnd - this.base - overlap)
      }
      let m
      while ((m = gre.exec(this.buf)) !== null) {
        const matchStart = this.base + m.index
        const matchEnd = matchStart + m[0].length
        const isNew = matchEnd > previousEnd &&
          matchStart >= state.startAt &&
          matchStart >= state.consumedEnd
        const cooldown = rule.cooldownMs == null ? 500 : rule.cooldownMs
        const canFire = mode !== 'cooldown' || now - state.lastFire >= cooldown
        if (isNew) {
          // Consume the occurrence even when cooldown suppresses its action.
          // This prevents a greedy regex rooted in old output from growing
          // into later chunks and being mistaken for a fresh match.
          state.consumedEnd = Math.max(state.consumedEnd, matchEnd)
          if (canFire) {
            this._fire(rule, m[0], state, now)
            if (mode === 'once') {
              break
            }
          }
        }
        if (m[0].length === 0) {
          gre.lastIndex++
        }
        if (gre.lastIndex > this.buf.length) {
          break
        }
      }
      state.seenEnd = streamEnd
    })
  }

  _fire (rule, matched, state, now) {
    state.lastFire = now
    if ((rule.mode || 'cooldown') === 'once') {
      state.firedOnce = true
    }
    try {
      const action = rule.action || { type: 'send', value: '' }
      if (action.type === 'send') {
        const text = expandControlChars(action.value || '')
        // default: append \r unless text already ends with \r or \n,
        // unless the user explicitly turned sendEnter off
        const enter = rule.sendEnter !== false
        const payload = enter && !/[\r\n]$/.test(text) ? text + '\r' : text
        this.send?.(payload, { rule, matched })
      }
      this.onFire?.({ rule, matched, kind: action.type || 'send' })
    } catch (e) {
      console.error('[trigger-engine] fire failed', e)
    }
  }

  dispose () {
    this.buf = ''
    this.base = 0
    this.rules = []
    this.reCache.clear()
    this.ruleState.clear()
  }
}

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
  constructor ({ send, maxBuffer = 65536, onFire = null } = {}) {
    this.send = send
    this.maxBuffer = maxBuffer
    this.onFire = onFire
    this.buf = ''
    this.rules = []
    this.reCache = new Map()
    this.lastFire = new Map()
    this.firedOnce = new Set()
  }

  setTriggers (rules) {
    this.rules = Array.isArray(rules) ? rules.filter(Boolean) : []
    this.reCache.clear()
    // drop per-rule runtime state for rules that no longer exist
    const ids = new Set(this.rules.map(r => r.id))
    for (const id of [...this.lastFire.keys()]) {
      if (!ids.has(id)) {
        this.lastFire.delete(id)
      }
    }
    for (const id of [...this.firedOnce]) {
      if (!ids.has(id)) {
        this.firedOnce.delete(id)
      }
    }
  }

  resetOnce (id = null) {
    if (id) {
      this.firedOnce.delete(id)
    } else {
      this.firedOnce.clear()
    }
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
      this.buf = this.buf.slice(this.buf.length - this.maxBuffer)
    }
    this._scan()
  }

  _scan () {
    const now = Date.now()
    for (const rule of this.rules) {
      if (!rule || rule.enabled === false) {
        continue
      }
      const mode = rule.mode || 'cooldown'
      if (mode === 'once' && this.firedOnce.has(rule.id)) {
        continue
      }
      if (mode === 'cooldown') {
        const cd = rule.cooldownMs == null ? 500 : rule.cooldownMs
        const last = this.lastFire.get(rule.id) || 0
        if (now - last < cd) {
          continue
        }
      }
      const re = this._getRe(rule)
      if (!re) {
        continue
      }
      // global flag + lastIndex walk so one chunk can fire several
      // distinct matches; per-rule cooldown still applies per match
      const gre = new RegExp(re.source, re.flags.includes('i') ? 'gi' : 'g')
      let m
      while ((m = gre.exec(this.buf)) !== null) {
        if (mode === 'cooldown') {
          const last = this.lastFire.get(rule.id) || 0
          if (Date.now() - last < (rule.cooldownMs == null ? 500 : rule.cooldownMs)) {
            break
          }
        }
        this._fire(rule, m[0])
        if (mode === 'once' || mode === 'cooldown') {
          break
        }
        // repeat: avoid zero-length infinite loop
        if (m[0].length === 0) {
          break
        }
      }
    }
  }

  _fire (rule, matched) {
    const now = Date.now()
    this.lastFire.set(rule.id, now)
    if ((rule.mode || 'cooldown') === 'once') {
      this.firedOnce.add(rule.id)
    }
    try {
      const action = rule.action || { type: 'send', value: '' }
      if (action.type === 'send') {
        const text = expandControlChars(action.value || '')
        // default: append \r unless text already ends with \r or \n,
        // unless the user explicitly turned sendEnter off
        const enter = rule.sendEnter !== false
        const payload = enter && text && !/[\r\n]$/.test(text) ? text + '\r' : text
        this.send?.(payload, { rule, matched })
      }
      this.onFire?.({ rule, matched, kind: action.type || 'send' })
    } catch (e) {
      console.error('[trigger-engine] fire failed', e)
    }
  }

  dispose () {
    this.buf = ''
    this.rules = []
    this.reCache.clear()
    this.lastFire.clear()
    this.firedOnce.clear()
  }
}

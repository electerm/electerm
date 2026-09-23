// Per-terminal-tab automation binding.
// Subscribes to the attach addon's decoded stream (before coalescing)
// and feeds it into a TriggerEngine that auto-sends responses.
import TriggerEngine from './trigger-engine.js'

function signature (rules) {
  try {
    return JSON.stringify((rules || []).map(r => [
      r.id, r.enabled, r.match?.type, r.match?.value,
      r.match?.caseSensitive, r.action?.type, r.action?.value,
      r.sendEnter, r.mode, r.cooldownMs
    ]))
  } catch (e) {
    return String(Date.now())
  }
}

export function createTriggerManager ({ attachAddon, send, getTriggers, onFire } = {}) {
  const engine = new TriggerEngine({ send, onFire })
  let lastSig = ''
  const sync = () => {
    const rules = getTriggers ? getTriggers() || [] : []
    const sig = signature(rules)
    if (sig !== lastSig) {
      lastSig = sig
      engine.setTriggers(rules)
    }
  }
  sync()
  let disposeTap = null
  if (attachAddon && typeof attachAddon.addDataTap === 'function') {
    disposeTap = attachAddon.addDataTap((str) => {
      try {
        sync()
        engine.push(str)
      } catch (e) {
        console.error('[trigger-manager]', e)
      }
    })
  }
  return {
    engine,
    refresh () {
      try {
        lastSig = ''
        sync()
      } catch (e) {
        console.error('[trigger-manager] refresh failed', e)
      }
    },
    dispose () {
      if (disposeTap) {
        disposeTap()
        disposeTap = null
      }
      engine.dispose()
    }
  }
}

export { TriggerEngine }
export { default as StreamMatcher } from './stream-matcher.js'
export { stripAnsi, normalizeCR } from './strip-ansi.js'
export { expandControlChars } from './keys.js'

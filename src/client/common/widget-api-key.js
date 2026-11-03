/**
 * API keys for built-in widgets that need one (today: the MCP server).
 *
 * The key has to outlive a restart. It used to be "optional": the run form
 * reset to an empty field on every visit, so the only way to keep
 * authentication on was to re-type the key on each launch — and in practice
 * everyone left it empty, which is how the MCP server ended up answering
 * unauthenticated requests from anything on the machine, including a
 * DNS-rebound web page.
 *
 * So: generate once, remember it, keep using it until the user types a
 * different one. localStorage is where this app already keeps per-widget form
 * state (components/widgets/custom-widget-form.jsx), and going through
 * safe-local-storage means the key is not sitting in plaintext next to the
 * rest of the profile.
 *
 * A field counts as a generated secret when its config entry sets
 * `showGenerator` — the flag the run form already uses to render the
 * "Generate" button, so the two stay in sync by construction.
 */

import { nanoid } from 'nanoid'
import { safeGetItem, safeSetItem } from './safe-local-storage'

const KEY_PREFIX = 'widget-api-key:'

export function apiKeyStorageKey (widgetId, fieldName) {
  return `${KEY_PREFIX}${widgetId}:${fieldName}`
}

export function readStoredApiKey (widgetId, fieldName) {
  return safeGetItem(apiKeyStorageKey(widgetId, fieldName))
}

export function rememberApiKey (widgetId, fieldName, key) {
  if (key) {
    safeSetItem(apiKeyStorageKey(widgetId, fieldName), key)
  }
}

// Same shape as the Generate button in config-fields.jsx, so a key that came
// from either path is recognisable.
export function generateApiKey () {
  return 'ett_' + nanoid()
}

/**
 * Fill in every generated-secret field the caller left empty.
 *
 * An empty field means "use the saved key", never "no key": an unauthenticated
 * server is the vulnerability, so there is no way to ask for one. A non-empty
 * value is the user's own choice and replaces what was stored.
 */
export function withPersistedApiKeys (widgetId, configs, config) {
  const secretConfigs = (configs || []).filter(c => c.showGenerator)
  if (!secretConfigs.length) {
    return config
  }
  const next = { ...config }
  for (const c of secretConfigs) {
    const typed = next[c.name]
    if (typeof typed === 'string' && typed.trim()) {
      next[c.name] = typed.trim()
      rememberApiKey(widgetId, c.name, next[c.name])
      continue
    }
    const stored = readStoredApiKey(widgetId, c.name)
    if (stored) {
      next[c.name] = stored
      continue
    }
    next[c.name] = generateApiKey()
    rememberApiKey(widgetId, c.name, next[c.name])
  }
  return next
}

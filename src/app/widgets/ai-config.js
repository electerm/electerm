/**
 * The AI config a widget may hand to the user.
 *
 * A widget can include `aiConfig` in a run or action result. Electerm shows
 * the proposed values in the widget panel. When the user applies them,
 * Electerm selects a matching saved AI configuration or creates one in
 * `aiConfigs` and sets it as active. A new configuration uses the proposed
 * endpoint credentials, with an empty API key or proxy when omitted.
 *
 * The field list is a whitelist, not a filter:
 *   - `roleAI` is the system prompt. A widget silently rewriting it would be
 *     prompt injection with extra steps, so it is not reachable from here.
 *   - `languageAI` / `contextLengthAI` have nothing to do with pointing
 *     electerm at an endpoint.
 * `nameAI` is the label the AI panel shows, which is why a widget that is not
 * a known provider can name itself instead of falling back to "Custom AI
 * Model".
 */

const MAX_LENGTH = {
  nameAI: 60,
  baseURLAI: 500,
  apiPathAI: 200,
  apiKeyAI: 500,
  authHeaderNameAI: 100,
  modelAI: 200,
  proxyAI: 300
}

const FIELDS = Object.keys(MAX_LENGTH)

function isPlainObject (value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cleanString (value, max) {
  if (typeof value !== 'string') {
    return ''
  }
  const trimmed = value.trim()
  // a value with a line break in it is a bug or a paste accident; either way it
  // has no business in a config field
  if (!trimmed || trimmed.length > max || /[\r\n]/.test(trimmed)) {
    return ''
  }
  return trimmed
}

function isHttpUrl (value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (e) {
    return false
  }
}

/**
 * @param {any} value whatever the widget put in `result.aiConfig`
 * @returns {object|null} a frozen configuration offer, or null when there is nothing
 *   usable in it. Without a base URL there is nothing to apply.
 */
function sanitizeAIConfig (value) {
  if (!isPlainObject(value)) {
    return null
  }
  const out = {}
  for (const field of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      continue
    }
    const raw = value[field]
    const clean = cleanString(raw, MAX_LENGTH[field])
    // A widget serving a local endpoint can explicitly offer an empty key or
    // proxy for its configuration. Drop invalid values separately.
    if (clean || (typeof raw === 'string' && !raw.trim())) {
      out[field] = clean
    }
  }
  if (!out.baseURLAI || !isHttpUrl(out.baseURLAI)) {
    return null
  }
  return Object.freeze(out)
}

module.exports = {
  sanitizeAIConfig,
  AI_CONFIG_FIELDS: FIELDS
}

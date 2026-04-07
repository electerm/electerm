import { termLSPrefix } from './constants'
import parseJsonSafe from './parse-json-safe'

// ─── Encryption helpers ───────────────────────────────────────────────────────

// Prefix that marks a value encrypted by this module.
// Values without this prefix are treated as legacy plaintext.
const ENC_PREFIX = 'enc1:'

let _encKey = null

function getKey () {
  if (_encKey !== null) return _encKey
  try {
    // window.pre is set by pre.js before the store is used; runSync is synchronous IPC
    _encKey = (window.pre && window.pre.runSync && window.pre.runSync('getStorageKey')) || ''
  } catch (e) {
    _encKey = ''
  }
  return _encKey
}

function encrypt (str) {
  if (!str) return str
  const key = getKey()
  if (!key) return str
  const strBytes = new TextEncoder().encode(str)
  const keyBytes = new TextEncoder().encode(key)
  const out = new Uint8Array(strBytes.length)
  for (let i = 0; i < strBytes.length; i++) {
    out[i] = strBytes[i] ^ keyBytes[i % keyBytes.length]
  }
  let binary = ''
  for (let i = 0; i < out.length; i++) {
    binary += String.fromCharCode(out[i])
  }
  return ENC_PREFIX + btoa(binary)
}

function decrypt (str) {
  if (!str || !str.startsWith(ENC_PREFIX)) return str
  const key = getKey()
  if (!key) return str
  try {
    const binary = atob(str.slice(ENC_PREFIX.length))
    const keyBytes = new TextEncoder().encode(key)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i) ^ keyBytes[i % keyBytes.length]
    }
    return new TextDecoder().decode(out)
  } catch (e) {
    return str
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

function clear () {
  const keys = Object.keys(window.localStorage)
  for (const key of keys) {
    if (key.startsWith(termLSPrefix)) {
      window.localStorage.removeItem(key)
    }
  }
}

// ─── Original (plain) functions ──────────────────────────────────────────────

export function setItem (id, str) {
  try {
    window.localStorage.setItem(id, str)
  } catch (e) {
    console.log(e)
    console.log('maybe local storage full, lets reset')
    clear()
    window.localStorage.setItem(id, str)
  }
}

export function getItem (id) {
  return window.localStorage.getItem(id) || ''
}

export function getItemJSON (id, defaultValue) {
  const str = window.localStorage.getItem(id) || ''
  const r = parseJsonSafe(str)
  if (typeof r === 'string') {
    return defaultValue
  }
  return r || defaultValue
}

export function setItemJSON (id, obj) {
  const str = JSON.stringify(obj)
  return setItem(id, str)
}

// ─── Safe (encrypted) functions ──────────────────────────────────────────────

export function safeSetItem (id, str) {
  if (window.et.isWebApp) {
    return setItem(id, str)
  }
  try {
    window.localStorage.setItem(id, encrypt(str))
  } catch (e) {
    console.log(e)
    console.log('maybe local storage full, lets reset')
    clear()
    window.localStorage.setItem(id, encrypt(str))
  }
}

export function safeGetItem (id) {
  if (window.et.isWebApp) {
    return getItem(id)
  }
  return decrypt(window.localStorage.getItem(id) || '')
}

export function safeGetItemJSON (id, defaultValue) {
  if (window.et.isWebApp) {
    return getItemJSON(id, defaultValue)
  }
  const str = decrypt(window.localStorage.getItem(id) || '')
  const r = parseJsonSafe(str)
  if (typeof r === 'string') {
    return defaultValue
  }
  return r || defaultValue
}

export function safeSetItemJSON (id, obj) {
  if (window.et.isWebApp) {
    return setItemJSON(id, obj)
  }
  const str = JSON.stringify(obj)
  return safeSetItem(id, str)
}

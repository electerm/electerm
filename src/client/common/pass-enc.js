const enc = (str) => {
  if (typeof str !== 'string') {
    return str
  }
  return str.split('').map((s, i) => {
    return String.fromCharCode((s.charCodeAt(0) + i + 1) % 65536)
  }).join('')
}

const dec = (str) => {
  if (typeof str !== 'string') {
    return str
  }
  return str.split('').map((s, i) => {
    return String.fromCharCode((s.charCodeAt(0) - i - 1 + 65536) % 65536)
  }).join('')
}

/**
 * enc password
 * @param {object} obj
 */
export function encObj (obj) {
  if (!obj.passwordEncrypted && obj.password) {
    obj.password = enc(obj.password)
    obj.passwordEncrypted = true
  }
  return obj
}

/**
 * dec password
 * @param {object} obj
 */
export function decObj (obj) {
  if (obj.passwordEncrypted && obj.password) {
    obj.password = dec(obj.password)
    delete obj.passwordEncrypted
  }
  return obj
}

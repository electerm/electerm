exports.enc = (str) => {
  if (typeof str !== 'string') {
    return str
  }
  return str.split('').map((s, i) => {
    return String.fromCharCode((s.charCodeAt(0) + i + 1) % 65536)
  }).join('')
}

exports.dec = (str) => {
  if (typeof str !== 'string') {
    return str
  }
  return str.split('').map((s, i) => {
    return String.fromCharCode((s.charCodeAt(0) - i - 1 + 65536) % 65536)
  }).join('')
}

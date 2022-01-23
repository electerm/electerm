exports.enc = (str) => typeof str !== 'string' 
  ? str
  :str.split('').map((s, i) => String.fromCharCode((s.charCodeAt(0) + i + 1) % 65536)).join('')


exports.dec = (str) => typeof str !== 'string'
  ? str
  : str.split('').map((s, i) => String.fromCharCode((s.charCodeAt(0) - i - 1 + 65536) % 65536)).join('')


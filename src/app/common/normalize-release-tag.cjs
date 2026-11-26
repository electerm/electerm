module.exports = function normalizeReleaseTag (value) {
  if (typeof value !== 'string') return ''
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(value.trim())
  return match ? 'v' + match[1] : ''
}

/**
 * time formatter
 */

function prefix (n) {
  const str = '' + n
  if (str.length < 2) {
    return '0' + str
  }
  return str
}

exports.default = module.exports = (
  time = new Date(),
  format = 'YYYY-MM-DD HH:mm:ss'
) => {
  const t = new Date(time)
  const d = t.getDate()
  const y = t.getFullYear()
  const m = t.getMonth()
  const h = t.getHours()
  const mm = t.getMinutes()
  const s = t.getSeconds()
  return format.replace('YYYY', prefix(y))
    .replace('MM', prefix(m + 1))
    .replace('DD', prefix(d))
    .replace('HH', prefix(h))
    .replace('mm', prefix(mm))
    .replace('ss', prefix(s))
}

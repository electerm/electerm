/**
 * time formatter
 */

function prefix(n) {
  let str = '' + n
  if (str.length < 2) {
    return '0' + str
  }
  return str
}

export default (
  time = new Date(),
  format = 'YYYY-MM-DD HH:mm:ss'
) => {
  let t = new Date(time)
  let d = t.getDate()
  let y = t.getFullYear()
  let m = t.getMonth()
  let h = t.getHours()
  let mm = t.getMinutes()
  let s = t.getSeconds()
  return format.replace('YYYY', prefix(y))
    .replace('MM', prefix(m + 1))
    .replace('DD', prefix(d))
    .replace('HH', prefix(h))
    .replace('mm', prefix(mm))
    .replace('ss', prefix(s))
}


// dom class方法

/**
 * add css class
 * @param elem
 * @param _classes
 */
export function addClass (elem, ..._classes) {
  const cls = elem.className || ''
  const classes = _classes.filter(c => {
    return !cls.includes(c)
  })
  if (!classes.length) {
    return
  }
  elem.className = cls + (cls ? ' ' : '') + classes.join(' ')
}

/**
 * has css class
 * @param elem
 * @param clst
 * @returns {boolean}
 */
export function hasClass (elem, clst) {
  let cls = elem.className || ''
  if (!cls) return false
  cls = ' ' + cls.split(/\s+/).join(' ') + ' '
  const reg = new RegExp(' ' + clst + ' ')
  return reg.test(cls)
}

/**
 * remove css class
 * @param elem
 * @param classes
 */
export function removeClass (elem, ...classes) {
  let cls = elem.className || ''
  if (!cls) return
  cls = '  ' + cls.split(/\s+/).join('  ') + '  '
  const clst = classes.join(' ').split(/\s+/)
  const reg = new RegExp(' ' + clst.join(' | ') + ' ', 'g')
  cls = cls.replace(reg, '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/ {2,}/g, ' ')

  elem.className = cls
}

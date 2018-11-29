
//dom class方法

/**
 * add css class
 * @param elem
 * @param _classes
 */
export function addClass (elem, ..._classes) {
  let cls = elem.className || ''
  let classes = _classes.filter(c => {
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
  if(!cls) return false
  cls = ' ' + cls.split(/\s+/).join(' ') + ' '
  let reg = new RegExp(' ' + clst + ' ')
  return reg.test(cls)
}

/**
 * remove css class
 * @param elem
 * @param classes
 */
export function removeClass (elem, ...classes) {
  let cls = elem.className || ''
  if(!cls) return
  cls = '  ' + cls.split(/\s+/).join('  ') + '  '
  let clst = classes.join(' ').split(/\s+/)
  let reg = new RegExp(' ' + clst.join(' | ') + ' ', 'g')
  cls = cls.replace(reg, '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/ {2,}/g, ' ')

  elem.className = cls
}


/**
 * convert mode / permission converter
 * (33188).toString(8) => 100644
 */

/**
 * digit to permission
 * @param {string} _d
 * @return {object} {read: Boolean, write: Boolean, exec: Boolean}
 */
function digit2permission(_d) {
  let d = parseInt(_d, 10)
  let arr = d.toString(2).split('')
  let len = arr.length
  for(let a = len - 3, i = 0;i < a;i ++) {
    arr.unshift('0')
  }
  let [rr, ww, xx] = arr
  let read = rr === '1'
  let write = ww === '1'
  let exec = xx === '1'
  return {
    read,
    write,
    exec
  }
}

/**
 * permission to digit
 * @param {object}  {read: Boolean, write: Boolean, exec: Boolean}
 * @return {string}
 */
function permission2digit({
  read,
  write,
  exec
}) {
  let arr = [
    read ? '1' : '0',
    write ? '1' : '0',
    exec ? '1' : '0'
  ]
  return new Number('0b' + arr.join('')).toString()
}

/**
 * mode to permission
 * @param {number}  mode
 * @return {array}
 */
export function mode2permission(mode) {
  let str = mode.toString(8)
  let len = str.length
  let perms = str.slice(len - 3, len).split('')
  let permNames = [
    'owner',
    'group',
    'other'
  ]
  return permNames.map((name, i) => {
    return {
      name,
      permission: digit2permission(perms[i])
    }
  })
}

/**
 * permission to mode
 * @param {array} arr
 * @return {string} eg, '644'
 */
export function permission2mode(arr) {
  return arr.reduce((prev, {permission}) => {
    return prev + permission2digit(permission)
  }, '')
}

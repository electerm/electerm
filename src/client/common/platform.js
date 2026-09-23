/**
 * Platform flags.
 *
 * Split out of constants.js: that module imports PNG assets at the top level,
 * which makes anything importing it unloadable in a plain Node (unit test)
 * context. Modules that only need isWin/isMac should import from here.
 */
const read = (name) => {
  if (typeof window === 'undefined') {
    return false
  }
  const { et, pre } = window
  if (et && typeof et[name] !== 'undefined') {
    return et[name]
  }
  return pre ? !!pre[name] : false
}

export const isWin = read('isWin')

export const isMac = read('isMac')

export const isMacJs = typeof navigator !== 'undefined' &&
  /Macintosh|Mac|Mac OS|MacIntel|MacPPC|Mac68K/gi.test(navigator.userAgent)

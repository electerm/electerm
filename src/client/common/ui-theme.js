/**
 * ui theme related
 */

export function getUiThemeConfig (stylus) {
  const reg = /[^\n]+ = [^\n]+\n/g
  const arr = stylus.match(reg)
  const sep = ' = '
  return arr.reduce((p, x) => {
    if (!x.includes(sep)) {
      return p
    }
    const [k, v] = x.split(sep)
    return {
      ...p,
      [k.trim()]: v.trim()
    }
  }, {})
}

/**
 * convert themeText to themeConfig object
 * @param {string} themeTxt
 * @return {object}
 */
export const convertTheme = (themeTxt) => {
  return themeTxt.split('\n').reduce((prev, line) => {
    let [key = '', value = ''] = line.split('=')
    key = key.trim()
    value = value.trim()
    if (!key || !value) {
      return prev
    }
    if (key === 'themeName') {
      prev.name = value.slice(0, 50)
    } else {
      prev.themeConfig[key] = value
    }
    return prev
  }, {
    name: 'unnamed theme',
    themeConfig: {}
  })
}

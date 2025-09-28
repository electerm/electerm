/**
 * ui theme related
 */

const defaultUiThemeStylus = `
  --main #141314
  --main-dark #000
  --main-light #2E3338
  --text #ddd
  --text-light #fff
  --text-dark #888
  --text-disabled #777
  --primary #08c
  --info #FFD166
  --success #06D6A0
  --error #EF476F
  --warn #E55934
`

export function getUiThemeConfig (stylus = defaultUiThemeStylus) {
  const lines = stylus.split('\n').filter(line => line.trim())
  return lines.reduce((p, line) => {
    const [k, v] = line.trim().replace('--', '').split(' ')
    if (k && v) {
      return {
        ...p,
        [k]: v
      }
    }
    return p
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

/**
 * theme control
 */

import { defaultTheme } from './constants'
import download from './download'
import copy from 'json-deep-copy'
const { prefix } = window
const t = prefix('terminalThemes')

/**
 * build default themes
 */
const buildDefaultThemes = () => {
  return {
    [defaultTheme.id]: defaultTheme
  }
}

/**
 * build new theme
 */
const buildNewTheme = () => {
  return Object.assign(
    copy(defaultTheme),
    {
      id: '',
      name: t('newTheme')
    }
  )
}

/**
 * convert theme object to themeText
 * @param {object} themeObj
 * @param {boolean} withName
 * @return {string}
 */
const convertThemeToText = (themeObj = {}, withName = false) => {
  const theme = themeObj || {}
  const { themeConfig = {}, name } = theme
  if (withName) {
    themeConfig.themeName = name
  }
  return Object.keys(themeConfig).reduce((prev, key) => {
    return prev +
      (prev ? '\n' : '') +
      key + '=' + themeConfig[key]
  }, '')
}

/**
 * convert themeText to themeConfig object
 * @param {string} themeTxt
 * @return {object}
 */
const convertTheme = (themeTxt) => {
  const keys = [
    ...Object.keys(defaultTheme.themeConfig),
    'themeName'
  ]
  return themeTxt.split('\n').reduce((prev, line) => {
    let [key = '', value = ''] = line.split('=')
    key = key.trim()
    value = value.trim()
    if (!key || !value || !keys.includes(key)) {
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

/**
 * get current
 * @return {object}
 */
const getCurrentTheme = () => {
  const ls = window.getGlobal('ls')
  const config = window.getGlobal('_config')
  const themes = copy(ls.get('themes') || buildDefaultThemes())
  const themeId = config.theme || defaultTheme.id
  const themeObj = themes[themeId] || defaultTheme
  return themeObj
}

/**
 * get theme list from ls
 * @return {array}
 */
const getThemes = () => {
  const ls = window.getGlobal('ls')
  const themes = copy(ls.get('themes') || buildDefaultThemes())
  return Object.keys(themes).reduce((prev, k) => {
    return [
      ...prev,
      themes[k]
    ]
  }, [])
}

/**
 * verify theme config
 * @param {object} themeConfig
 * @return {array} extra keys
 */
const verifyTheme = (themeConfig) => {
  const keysRight = Object.keys(defaultTheme.themeConfig)
  const keys = Object.keys(themeConfig)
  const extraKeys = keys.filter(k => !keysRight.includes(k))
  return extraKeys
}

/**
 * export theme as txt
 * @param {string} themeId
 */
const exportTheme = (themeId) => {
  const ls = window.getGlobal('ls')
  const themes = copy(ls.get('themes') || buildDefaultThemes())
  const theme = themes[themeId]
  const text = convertThemeToText(theme, true)
  download(
    `${theme.name}.txt`,
    text
  )
}

export {
  getCurrentTheme,
  verifyTheme,
  convertTheme,
  exportTheme,
  defaultTheme,
  getThemes,
  convertThemeToText,
  buildNewTheme
}

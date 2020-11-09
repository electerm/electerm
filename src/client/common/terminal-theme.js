/**
 * theme control
 */

import { defaultTheme } from '../common/constants'
import download from '../common/download'
import copy from 'json-deep-copy'
import { findOne } from './db'
const { prefix } = window
const t = prefix('terminalThemes')
const terminalPrefix = 'terminal:'

/**
 * build default themes
 */
export const buildDefaultThemes = () => {
  return {
    [defaultTheme.id]: defaultTheme
  }
}

/**
 * build new theme
 */
export const buildNewTheme = (theme = defaultTheme) => {
  return Object.assign(
    copy(theme),
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
export const convertThemeToText = (themeObj = {}, withName = false) => {
  const theme = themeObj || {}
  const { themeConfig = {}, name, uiThemeConfig = {} } = theme
  const begin = withName
    ? `themeName=${name}\n`
    : ''
  const res = Object.keys(uiThemeConfig).reduce((prev, key) => {
    return prev +
      (prev ? '\n' : '') +
      key + '=' + uiThemeConfig[key]
  }, begin)
  return Object.keys(themeConfig).reduce((prev, key) => {
    return prev +
      (prev ? '\n' : '') + terminalPrefix +
      key + '=' + themeConfig[key]
  }, res)
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
      const isTerminal = key.startsWith(terminalPrefix)
      key = key.replace(terminalPrefix, '')
      if (isTerminal) {
        prev.themeConfig[key] = value
      } else {
        prev.uiThemeConfig[key] = value
      }
    }
    return prev
  }, {
    themeConfig: {},
    uiThemeConfig: {}
  })
}

/**
 * verify theme config
 * @param {object} themeConfig
 * @return {array} extra keys
 */
export const verifyTheme = (themeConfig) => {
  const keysRight = Object.keys(defaultTheme.themeConfig)
  const keys = Object.keys(themeConfig)
  const extraKeys = keys.filter(k => !keysRight.includes(k))
  return extraKeys
}

/**
 * export theme as txt
 * @param {string} themeId
 */
export const exportTheme = async (themeId) => {
  const themes = await findOne('terminalThemes', themeId) || buildDefaultThemes()
  const theme = themes[themeId] || themes
  if (!theme) {
    log.error('export error', themeId)
    return
  }

  const text = convertThemeToText(theme, true)
  download(
    `${theme.name}.txt`,
    text
  )
}

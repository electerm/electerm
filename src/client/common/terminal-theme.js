/**
 * theme control
 */

import { defaultTheme } from '../common/constants'
import download from '../common/download'
import copy from 'json-deep-copy'
import { dbAction } from './db'
const { prefix } = window
const t = prefix('terminalThemes')

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
export const buildNewTheme = () => {
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
export const convertThemeToText = (themeObj = {}, withName = false) => {
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
export const convertTheme = (themeTxt) => {
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
  const themes = await dbAction('terminalThemes', 'findOne', {
    _id: themeId
  }) || buildDefaultThemes()
  const theme = themes[themeId]
  const text = convertThemeToText(theme, true)
  download(
    `${theme.name}.txt`,
    text
  )
}

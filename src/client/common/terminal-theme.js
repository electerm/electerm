/**
 * theme control
 */

import { defaultTheme, settingMap } from '../common/constants'
import download from '../common/download'
import copy from 'json-deep-copy'
const e = window.translate
const terminalPrefix = 'terminal:'
export const requiredThemeProps = [
  'main',
  'main-dark',
  'main-light',
  'text',
  'text-light',
  'text-dark',
  'text-disabled',
  'primary',
  'info',
  'success',
  'error',
  'warn',
  'terminal:foreground',
  'terminal:background',
  'terminal:cursor',
  'terminal:cursorAccent',
  'terminal:selectionBackground',
  'terminal:black',
  'terminal:red',
  'terminal:green',
  'terminal:yellow',
  'terminal:blue',
  'terminal:magenta',
  'terminal:cyan',
  'terminal:white',
  'terminal:brightBlack',
  'terminal:brightRed',
  'terminal:brightGreen',
  'terminal:brightYellow',
  'terminal:brightBlue',
  'terminal:brightMagenta',
  'terminal:brightCyan',
  'terminal:brightWhite'
]
export const validThemeProps = [
  ...requiredThemeProps,
  'name'
]
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
      name: e('newTheme')
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
      if (key.includes('selection')) {
        key = 'selectionBackground'
      }
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
export const exportTheme = (themeId) => {
  const themes = window.store.getSidebarList(settingMap.terminalThemes)
  const theme = themes.find(d => d.id === themeId)
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

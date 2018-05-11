/**
 * theme control
 */

import {defaultTheme} from './constants'
import download from './download'

const convertTheme = (themeTxt) => {
  return themeTxt.split('\n').reduce((prev, line) => {
    let [key, value] = line.split('=')
    return {
      ...prev,
      [key]: value
    }
  }, {})
}

const getCurrentTheme = () => {
  const ls = window.getGlobal('ls')
  let themes = ls.get('themes') || {
    default: defaultTheme
  }
  let themeName = ls.get('theme') || 'default'
  let themeObj = themes[themeName] || defaultTheme
  return {
    name: themeName,
    theme: themeObj
  }
}

const getThemes = () => {
  const ls = window.getGlobal('ls')
  let themes = ls.get('themes') || {
    default: defaultTheme
  }
  return themes.reduce((prev, k) => {
    return [
      ...prev,
      {
        theme: themes[k],
        name: k
      }
    ]
  }, [])
}

const setTheme = (themeName) => {
  const ls = window.getGlobal('ls')
  ls.set('theme', themeName)
}

const verifyTheme = (theme) => {
  //todo
  return true || theme
}

const importTheme = (themeName, themeText) => {
  const ls = window.getGlobal('ls')
  let themes = ls.get('themes') || {
    default: defaultTheme
  }
  themes[themeName] = convertTheme(themeText)
  ls.set('themes', themes)
}

const exportTheme = (themeName) => {
  const ls = window.getGlobal('ls')
  let themes = ls.get('themes') || {
    default: defaultTheme
  }
  let theme = themes[themeName]
  let text = Object.keys(theme).reduce((prev, key) => {
    return prev + '\n' +
      key + '=' + theme[key]
  }, '')
  download(
    `${themeName}.txt`,
    text
  )
}

const delTheme = (themeName) => {
  const ls = window.getGlobal('ls')
  let themes = ls.get('themes') || {
    default: defaultTheme
  }
  delete themes[themeName]
  ls.set('themes', themes)
}

const editTheme = (themeName, update) => {
  const ls = window.getGlobal('ls')
  let themes = ls.get('themes') || {
    default: defaultTheme
  }
  Object.assign(themes[themeName], update)
  ls.set('themes', themes)
}

export default {
  getCurrentTheme,
  setTheme,
  verifyTheme,
  convertTheme,
  importTheme,
  exportTheme,
  editTheme,
  getThemes,
  delTheme
}

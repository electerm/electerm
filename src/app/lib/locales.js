/**
 * multi language support
 */

const { isDev, defaultLang } = require('../common/runtime-constants')
const { resolve } = require('path')

function getOsLocale () {
  return require('os-locale-s')
    .osLocale()
    .catch(() => '')
}

async function loadLocales () {
  const sysLocale = await getOsLocale() || defaultLang
  const path = (isDev
    ? '../../'
    : '') +
    '../node_modules/@electerm/electerm-locales/dist'
  const localeFolder = resolve(__dirname, path)
  // languages array
  const langs = require(resolve(localeFolder, 'list.json'))
    .map(fileName => {
      const filePath = resolve(localeFolder, fileName)
      const lang = require(filePath)
      return {
        path: filePath,
        id: fileName.replace('.js', ''),
        name: lang.name,
        reg: lang.match,
        lang: lang.lang
      }
    })
  const langMap = langs.reduce((prev, l) => {
    prev[l.id] = l
    return prev
  }, {})
  return {
    langs,
    langMap,
    sysLocale
  }
}

function findLang (langs, la) {
  let res = false
  for (const l of langs) {
    res = new RegExp(l.reg).test(la)
    if (res) {
      res = l.id
      break
    }
  }
  return res
}

const getLang = (config, sysLocale, langs) => {
  if (config.language) {
    return config.language
  }
  let l = sysLocale
  l = l ? l.toLowerCase().replace('-', '_') : defaultLang
  return findLang(langs, l) || defaultLang
}

exports.getLang = getLang
exports.loadLocales = loadLocales

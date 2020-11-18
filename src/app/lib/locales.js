/**
 * multi language support
 */

const { isDev, defaultLang } = require('../utils/constants')
const fs = require('fs')
const _ = require('lodash')
const { resolve } = require('path')

async function loadLocales () {
  const sysLocale = await require('os-locale-s').osLocale() || defaultLang
  const path = (isDev
    ? '../../'
    : '') +
    '../node_modules/@electerm/electerm-locales/dist'
  const localeFolder = resolve(__dirname, path)
  // languages array
  const langs = fs.readdirSync(localeFolder)
    .map(fileName => {
      const filePath = resolve(localeFolder, fileName)
      const lang = require(filePath)
      return {
        path: filePath,
        id: fileName.replace('.json', ''),
        name: lang.name,
        match: lang.match,
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
    if (_.isRegExp(l.match)) {
      res = l.match.test(la)
    } else if (_.isFunction(l.match)) {
      res = l.match(la)
    } else {
      res = l.id === la
    }
    if (res) {
      res = l.id
      break
    }
  }
  return res
}

const getLang = (config, sysLocale) => {
  if (config.language) {
    return config.language
  }
  let l = sysLocale
  l = l ? l.toLowerCase().replace('-', '_') : defaultLang
  return findLang(l) || defaultLang
}

exports.getLang = getLang
exports.loadLocales = loadLocales

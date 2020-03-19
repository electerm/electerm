/**
 * multi language support
 */

const { isDev, defaultLang } = require('../utils/constants')
const fs = require('fs')
const _ = require('lodash')
const { resolve } = require('path')
const { sync } = require('os-locale')

exports.sysLocale = sync()

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
      match: lang.match
    }
  })
const langMap = langs.reduce((prev, l) => {
  prev[l.id] = l
  return prev
}, {})

function findLang (la) {
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

const getLang = (config) => {
  if (config.language) {
    return config.language
  }
  let l = exports.sysLocale
  l = l ? l.toLowerCase().replace('-', '_') : defaultLang
  return findLang(l) || defaultLang
}

exports.lang = null
let language = null

/**
 * string translate
 * @param {string} id eg: 'menu.cut'
 */
exports.e = id => {
  return _.get(exports.lang, id) || id
}

function capitalizeFirstLetter (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

exports.prefix = prefix => {
  if (language === 'en_us') {
    return (id) => {
      return capitalizeFirstLetter(_.get(exports.lang, `${prefix}.${id}`) || id)
    }
  }
  return (id) => {
    return _.get(exports.lang, `${prefix}.${id}`) || id
  }
}

exports.langs = langs

exports.saveLangConfig = (saveUserConfig, userConfig) => {
  if (!userConfig.language) {
    saveUserConfig({
      language
    })
  }
}

exports.initLang = (userConf) => {
  language = getLang(userConf)
  exports.lang = require(langMap[language].path).lang
}

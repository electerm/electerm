/**
 * multi language support
 */

const {isDev, defaultLang} = require('./constants')
const fs = require('fs')
const _ = require('lodash')
const {resolve} = require('path')
const {userConfig} = require('./user-config-controller')
const {sync} = require('os-locale')

let path = (isDev
  ? '../'
  : '') +
  '../node_modules/electerm-locales/locales'
let localeFolder = resolve(__dirname, path)

//languages array
const langs = fs.readdirSync(localeFolder)
  .map(fileName => {
    let filePath = resolve(localeFolder, fileName)
    let lang = require(filePath)
    return {
      path: filePath,
      id: fileName.replace('.js', ''),
      name: lang.name
    }
  })
const langMap = langs.reduce((prev, l) => {
  prev[l.id] = l
  return prev
}, {})

const getLang = () => {
  if (userConfig.language) {
    return userConfig.language
  }
  let l = sync().toLowerCase() || defaultLang
  if (langMap[l]) {
    return l
  }
  return defaultLang
}

let language = getLang()

exports.lang = require(langMap[language].path).lang

/**
 * string translate
 * @param {string} id eg: 'menu.cut'
 */
exports.e = id => {
  return _.get(exports.lang, id) || id
}

exports.prefix = prefix => {
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



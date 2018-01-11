/**
 * multi language support
 */

const {isDev, defaultLang} = require('./constants')
const fs = require('fs')
const _ = require('lodash')
const {resolve} = require('path')
const {userConfig} = require('./user-config-controller')

let path = (isDev
  ? '../'
  : '') +
  '../node_modules/electerm-locales/locales'
let localeFolder = resolve(__dirname, path)
let lang

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

let language = userConfig.language || defaultLang
exports.lang = require(langMap[language].path)

/**
 * string translate
 * @param {string} id eg: 'menu.cut'
 */
exports.e = id => {
  return _.get(lang, id) || id
}

exports.prefix = prefix => {
  return (id) => {
    return _.get(lang, `${prefix}.${id}`) || id
  }
}

exports.langs = langs

exports.saveLangConfig = (saveUserConfig, userConfig) => {
  if (!userConfig.language) {
    saveUserConfig({
      language: defaultLang
    })
    language = defaultLang
  }
}



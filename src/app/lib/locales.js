/**
 * multi language support
 */

import {isDev, defaultLang} from '../utils/constants'
import fs from 'fs'
import _ from 'lodash'
import {resolve} from 'path'
import {userConfig} from './user-config-controller'
import {sync} from 'os-locale'

let path = (isDev
  ? '../'
  : '') +
  '../node_modules/@electerm/electerm-locales/locales'
let localeFolder = resolve(__dirname, path)

//languages array
const langsAll = fs.readdirSync(localeFolder)
  .map(fileName => {
    let filePath = resolve(localeFolder, fileName)
    let lang = require(filePath)
    return {
      path: filePath,
      id: fileName.replace('.js', ''),
      name: lang.name,
      match: lang.match
    }
  })
const langMap = langsAll.reduce((prev, l) => {
  prev[l.id] = l
  return prev
}, {})

function findLang(la) {
  let res = false
  for (let l of langsAll) {
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

const getLang = () => {
  if (userConfig.language) {
    return userConfig.language
  }
  let l = sync()
  l = l ? l.toLowerCase().replace('-', '_') : defaultLang
  return findLang(l) || defaultLang
}

let language = getLang()

export const lang = require(langMap[language].path).lang

/**
 * string translate
 * @param {string} id eg: 'menu.cut'
 */
export const e = id => {
  return _.get(exports.lang, id) || id
}

export const prefix = prefix => {
  return (id) => {
    return _.get(exports.lang, `${prefix}.${id}`) || id
  }
}

export const langs = langsAll

export const saveLangConfig = (saveUserConfig, userConfig) => {
  if (!userConfig.language) {
    saveUserConfig({
      language
    })
  }
}



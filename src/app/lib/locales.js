/**
 * multi language support
 */

const { isDev, defaultLang } = require('../common/runtime-constants')
const { resolve } = require('path')
const toolbarLabels = {
  'en_us.js': { broadcastLabel: 'Broadcast input' },
  'zh_cn.js': { keepalive: '会话保活', menu: '菜单', broadcastLabel: '广播输入' },
  'zh_tw.js': { keepalive: '保持連線', menu: '選單', broadcastLabel: '廣播輸入' }
}

function getOsLocale () {
  // Explorer normally supplies no POSIX locale. Avoid spawning PowerShell
  // to read the regional format; this runs after Electron is ready.
  const { LC_ALL, LC_MESSAGES, LANG, LANGUAGE } = process.env
  if (process.platform === 'win32' && !(LC_ALL || LC_MESSAGES || LANG || LANGUAGE)) {
    return require('electron').app.getSystemLocale()
  }
  return require('os-locale-s')
    .osLocale()
    .catch(() => '')
}

async function loadLocales () {
  const sysLocale = await getOsLocale() || defaultLang
  const path = (isDev
    ? '../../'
    : '') +
    '../node_modules/@electerm/electerm-locales/dist/cjs'
  const localeFolder = resolve(__dirname, path)
  // The portable build indexes language names at package time. Reading the
  // menu no longer requires evaluating every translation dictionary.
  const index = resolve(__dirname, '../locale-choices.json')
  const langs = !isDev && require('fs').existsSync(index)
    ? require(index)
    : require(resolve(localeFolder, 'list.json')).map(file => {
      const { name, match } = require(resolve(localeFolder, file))
      return { id: file.replace('.js', ''), name, reg: match }
    })
  const langMap = langs.reduce((prev, l) => {
    const file = l.id + '.js'
    prev[l.id] = {
      ...l,
      get lang () {
        const dict = require(resolve(localeFolder, file)).lang
        const value = toolbarLabels[file] ? { ...dict, ...toolbarLabels[file] } : dict
        Object.defineProperty(this, 'lang', { value, enumerable: true })
        return value
      }
    }
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

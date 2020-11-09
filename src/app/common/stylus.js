/**
 * style compiler
 * collect all stylus files in src/client and merge into one str
 */

// const { isDev } = require('../utils/app-props')
const { resolve } = require('path')
const { readFileSync } = require('fs')
const stylus = require('stylus')
const _ = require('lodash')

function toCss (str) {
  return new Promise((resolve, reject) => {
    stylus.render(str, (err, css) => {
      if (err) {
        reject(err)
      } else {
        resolve(css)
      }
    })
  })
}

function findFiles (pattern) {
  return require('glob').sync(pattern)
}

function loadDevStylus () {
  const dir = resolve(__dirname, '../../client')
  const pat = dir + '/**/*.styl'
  const arr = findFiles(pat)
  const key = 'theme-default.styl'
  arr.sort((a, b) => {
    const ai = a.includes(key) ? 1 : 0
    const bi = b.includes(key) ? 1 : 0
    return bi - ai
  })
  let all = ''
  for (const p of arr) {
    const text = readFileSync(p).toString()
    if (text.includes('@require') || text.includes(' = ')) {
      all = all + text
    }
  }
  all = all.replace(/@require[^\n]+\n/g, '\n')
  return all
}

function loadProdStylus () {
  const p = resolve(__dirname, '../assets/external/style.styl')
  return readFileSync(p).then(toString)
}

function getDefaultThemeConfig (stylus) {
  const reg = /[^\n]+ = [^\n]+\n/g
  const arr = stylus.match(reg)
  const sep = ' = '
  return arr.reduce((p, x) => {
    if (!x.includes(sep)) {
      return p
    }
    const [k, v] = x.split(sep)
    return {
      ...p,
      [k.trim()]: v.trim()
    }
  }, {})
}

function loadStylus (isDev) {
  let stylus = ''
  if (isDev) {
    stylus = loadDevStylus()
  } else {
    stylus = loadProdStylus()
  }
  const defaultThemeConfig = getDefaultThemeConfig(stylus)
  return {
    stylus,
    defaultThemeConfig
  }
}

async function buildTheme (isDev, config) {
  let { stylus, defaultThemeConfig } = loadStylus(isDev)
  const keys = Object.keys(config)
  for (const key of keys) {
    const reg = new RegExp(_.escapeRegExp(key) + ' = [^\\n]+\\n')
    const v = config[key]
    stylus = stylus.replace(reg, `${key} = ${v}\n`)
  }
  const css = await toCss(stylus)
  return {
    css,
    stylus,
    defaultThemeConfig
  }
}

exports.loadStylus = loadStylus
exports.loadDevStylus = loadDevStylus
exports.buildTheme = buildTheme
exports.toCss = toCss

// async function test () {
//   const x = getDefaultThemeConfig(true)
//   console.log(x)
// }

// test()

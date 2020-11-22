/**
 * style compiler
 * collect all stylus files in src/client and merge into one str
 */

const stylus = require('stylus')
const less = require('less')
const { resolve } = require('path')
const { dbAction } = require('./nedb')
const {
  packInfo: {
    version
  },
  isDev
} = require('../utils/constants')
const eq = require('fast-deep-equal')
const { readFileSync } = require('fs')

const id = 'less-cache'

function stylus2Css (str) {
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

async function toCss (stylus, config) {
  const cache = await dbAction('data', 'findOne', {
    _id: id
  })
  if (
    cache &&
    cache.version === version &&
    eq(cache.config, config)
  ) {
    return cache
  }
  const path = resolve(
    __dirname,
    isDev
      ? '../../client/css/less-dev.less'
      : '../assets/external/less-prod.less'
  )
  const content = readFileSync(path).toString()
  const r = await less.render(content, {
    filename: path,
    modifyVars: config,
    javascriptEnabled: true
  })
  const stylusCss = await stylus2Css(stylus)
  const up = {
    lessCss: r.css,
    stylusCss,
    version,
    config,
    isDev
  }
  if (!cache) {
    await dbAction('data', 'insert', {
      _id: id,
      ...up
    })
  } else {
    await dbAction('data', 'update', {
      _id: id
    }, up)
  }
  return up
}

function clearCssCache () {
  return dbAction('data', 'remove', {
    _id: id
  })
}
exports.clearCssCache = clearCssCache
exports.toCss = toCss

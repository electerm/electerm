/**
 * style compiler
 * collect all stylus files in src/client and merge into one str
 */

const stylus = require('stylus')
const { dbAction } = require('./nedb')
const {
  packInfo: {
    version
  },
  isDev
} = require('../common/runtime-constants')
const eq = require('fast-deep-equal')

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

async function toCss (stylus) {
  const cache = await dbAction('data', 'findOne', {
    _id: id
  })
  if (
    cache &&
    cache.version === version
  ) {
    return cache
  }

  const stylusCss = await stylus2Css(stylus)
  const up = {
    stylusCss,
    version,
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

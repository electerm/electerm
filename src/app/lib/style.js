/**
 * style compiler
 * collect all stylus files in src/client and merge into one str
 */

const stylus = require('stylus')
const {
  packInfo: {
    version
  },
  isDev
} = require('../common/runtime-constants')

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
  const stylusCss = await stylus2Css(stylus)
  const up = {
    stylusCss,
    version,
    isDev
  }
  return up
}

exports.toCss = toCss

/**
 * style compiler
 * collect all stylus files in src/client and merge into one str
 */

// const { isDev } = require('../utils/app-props')
const stylus = require('stylus')

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

exports.toCss = toCss

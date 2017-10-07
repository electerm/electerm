
const extend = require('recursive-assign')
const fp = require('find-free-port')
const {resolve} = require('path')
let override = {}
let cwd = process.cwd()

try {
  override = require(resolve(cwd + '/config'))
} catch(e) {
  console.log('no config.js, but it is ok')
}

module.exports = function() {
  return new Promise((resolve) => {
    fp(3000, function(err, freePort){
      let conf = {
        port: freePort,
        host: '127.0.0.1'
      }
      resolve(
        extend(conf, override)
      )
    })
  })
}


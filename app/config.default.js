
const extend = require('recursive-assign')
const fp = require('find-free-port')
const {resolve} = require('path')
const appPath = require('./lib/app-path')
let override = {}
let userConfig = {}

module.exports = function() {
  try {
    override = require(resolve(appPath, 'config.js'))
  } catch(e) {
    console.log('no config.js, but it is ok')
  }
  
  try {
    userConfig = require(resolve(appPath, 'user-config.json'))
  } catch(e) {
    console.log('no user-config.json, but it is ok')
  }
  return new Promise((resolve) => {
    fp(3000, function(err, freePort){
      let conf = {
        port: freePort,
        host: '127.0.0.1',
        hotkey: 'Control+2',
        showMenu: true
      }
      extend(conf, override)
      extend(conf, userConfig)
      resolve(conf)
    })
  })
}


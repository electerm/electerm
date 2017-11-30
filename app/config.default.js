
const extend = require('recursive-assign')
const fp = require('find-free-port')
const {resolve} = require('path')
const appPath = require('./lib/app-path')

module.exports = function() {
  let override = {}
  let userConfig = {}
  let configPath = resolve(appPath, 'electerm-config.js')
  let userConfigPath = resolve(appPath, 'electerm-user-config.json')

  try {
    override = require(configPath)
  } catch(e) {
    console.log('no', configPath, 'but it is ok')
  }
  try {
    userConfig = require(userConfigPath)
  } catch(e) {
    console.log('no', userConfigPath, 'but it is ok')
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



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
    fp(3075, '127.0.0.1', function(err, freePort){
      let defaultSettings = {
        hotkey: 'Control+2',
        sshReadyTimeout: 50000,
        scrollback: 3000,
        fontSize: 16,
        fontFamily: 'mono, courier-new, courier, monospace'
      }
      let conf = {
        port: freePort,
        host: 'localhost',
        keepaliveInterval: 20 * 1000,
        rightClickSelectsWord: false,
        showMenu: true,
        ...defaultSettings,
        defaultSettings,
        terminalTimeout: 5000
      }
      extend(conf, override)
      extend(conf, userConfig)
      resolve(conf)
    })
  })
}


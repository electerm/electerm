
const extend = require('recursive-assign')
const fp = require('find-free-port')
const { resolve } = require('path')
const { appPath } = require('./app-props')
const log = require('./log')

module.exports = function () {
  let override = {}
  let userConfig = {}
  const configPath = resolve(appPath, 'electerm-config.js')
  const userConfigPath = resolve(appPath, 'electerm-user-config.json')

  try {
    override = require(configPath)
  } catch (e) {
    log.info('no', configPath, 'but it is ok')
  }
  try {
    userConfig = require(userConfigPath)
  } catch (e) {
    log.info('no', userConfigPath, 'but it is ok')
  }

  return new Promise((resolve, reject) => {
    fp(3075, '127.0.0.1', function (err, freePort) {
      if (err) {
        reject(err)
      }
      const defaultSettings = {
        hotkey: 'Control+2',
        sshReadyTimeout: 50000,
        scrollback: 3000,
        fontSize: 16,
        fontFamily: 'mono, courier-new, courier, monospace',
        execWindows: 'System32/WindowsPowerShell/v1.0/powershell.exe',
        execMac: 'bash',
        execLinux: 'bash',
        enableGlobalProxy: false,
        disableSshHistory: false,
        disableTransferHistory: false,
        terminalBackgroundImagePath: '',
        rendererType: 'canvas'
      }
      const conf = {
        port: freePort,
        host: 'localhost',
        keepaliveInterval: 20 * 1000,
        rightClickSelectsWord: false,
        showMenu: true,
        ...defaultSettings,
        defaultSettings,
        terminalTimeout: 5000,
        opacity: 1,
        proxyPort: 1080,
        proxyType: '5',
        proxyIp: '127.0.0.1',
        zoom: 1
      }
      extend(conf, override)
      extend(conf, userConfig)
      resolve(conf)
    })
  })
}

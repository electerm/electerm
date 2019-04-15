

/**
 * user-controll.json controll
 */
const fs = require('fs')
const {resolve} = require('path')
const appPath = require('./app-path')
exports.userConfig = {}
const userConfigPath = resolve(appPath, 'electerm-user-config.json')

try {
  exports.userConfig = require(userConfigPath)
} catch (e) {
  console.log('no user config, but it is ok')
}

exports.saveUserConfig = (conf) => {
  Object.assign(global.et._config, conf)
  Object.assign(exports.userConfig, conf)
  fs.writeFileSync(
    userConfigPath,
    JSON.stringify(exports.userConfig)
  )
}


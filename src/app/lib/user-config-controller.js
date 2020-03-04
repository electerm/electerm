
/**
 * user-controll.json controll
 */
const fs = require('fs')
const { resolve } = require('path')
const { appPath } = require('../utils/app-props')
const log = require('../utils/log')
const userConfigPath = resolve(appPath, 'electerm-user-config.json')

exports.userConfig = {}

try {
  exports.userConfig = require(userConfigPath)
} catch (e) {
  log.info('no user config, but it is ok')
}

exports.saveUserConfig = (conf) => {
  Object.assign(global.et._config, conf)
  Object.assign(exports.userConfig, conf)
  fs.writeFileSync(
    userConfigPath,
    JSON.stringify(exports.userConfig)
  )
}

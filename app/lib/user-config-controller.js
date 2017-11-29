/**
 * user-controll.json controll
 */
const fs = require('fs')
const {resolve} = require('path')
const appPath = require('./app-path')

exports.saveUserConfig = (conf) => {
  Object.assign(global._config, conf)
  fs.writeFileSync(
    resolve(appPath, 'user-config.json'),
    JSON.stringify(conf)
  )
}


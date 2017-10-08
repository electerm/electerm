/**
 * user-controll.json controll
 */
const fs = require('fs')
const {resolve} = require('path')

exports.saveUserConfig = (conf) => {
  Object.assign(global._config, conf)
  fs.writeFileSync(
    resolve(__dirname, '../user-config.json'),
    JSON.stringify(conf)
  )
}




/**
 * user-controll.json controll
 */
import fs from 'fs'
import {resolve} from 'path'
import appPath from '../utils/app-path'
import log from '../utils/log'

const userConfigPath = resolve(appPath, 'electerm-user-config.json')

let userConfigAll = {}

try {
  userConfigAll = require(userConfigPath)
} catch (e) {
  log.debug('no user config, but it is ok')
}

export let userConfig = userConfigAll

export const saveUserConfig = (conf) => {
  Object.assign(global.et._config, conf)
  Object.assign(exports.userConfig, conf)
  fs.writeFileSync(
    userConfigPath,
    JSON.stringify(exports.userConfig)
  )
}



/**
 * user-controll.json controll
 */
const fs = require('fs')
const { resolve } = require('path')
const { appPath } = require('../utils/app-props')
const log = require('../utils/log')
const { dbAction } = require('./nedb')

exports.userConfig = {}

exports.saveUserConfig = (conf) => {
  Object.assign(global.et._config, conf)
  Object.assign(exports.userConfig, conf)
  dbAction('data', 'update', {
    _id: 'userConfig'
  }, )
}

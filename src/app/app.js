/**
 * app entry
 */
require('v8-compile-cache')
const log = require('./common/log')
const { createApp } = require('./lib/create-app')

global.et = {
  timer: null
}
global.initTime = Date.now()
global.win = null
global.childPid = null

log.debug('electerm start')

const app = createApp()
global.app = app

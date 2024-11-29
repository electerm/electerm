/**
 * app entry
 */
const log = require('./common/log')
const { createApp } = require('./lib/create-app')
const globalState = require('./lib/glob-state')

globalState.set('initTime', Date.now())

log.debug('electerm start')

const app = createApp()
globalState.set('app', app)

/**
 * app path
 */
const { app } = require('electron')
const constants = require('./runtime-constants')
module.exports = {
  appPath: app.getPath('appData'),
  ...constants
}

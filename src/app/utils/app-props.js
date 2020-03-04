/**
 * app path
 */
const { app } = require('electron')
const constants = require('./constants')
module.exports = {
  appPath: app.getPath('appData'),
  ...constants
}

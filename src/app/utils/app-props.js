/**
 * app path
 */
const { app } = require('electron')
const constants = require('./constants')
console.log(constants, 'hhh')
module.exports = {
  appPath: app.getPath('appData'),
  ...constants
}

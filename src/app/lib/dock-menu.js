/**
 * app system menu config
 */
const {
  Menu
} = require('electron')
const openNewInstance = require('./open-new-instance')

exports.buildDocMenu = function () {
  const e = global.et.prefix('control')
  return Menu.buildFromTemplate([
    {
      label: e('newWindow'),
      click () {
        openNewInstance()
      }
    }
  ])
}

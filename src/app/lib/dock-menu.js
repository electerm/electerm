/**
 * app system menu config
 */
const {
  Menu
} = require('electron')
const openNewInstance = require('./open-new-instance')
const globalState = require('./glob-state')

exports.buildDocMenu = function () {
  const e = globalState.get('translate')
  return Menu.buildFromTemplate([
    {
      label: e('newWindow'),
      click () {
        openNewInstance()
      }
    }
  ])
}

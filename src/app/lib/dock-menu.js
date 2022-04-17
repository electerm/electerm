/**
 * app system menu config
 */
const {
  Menu
} = require('electron')
const openNewInstance = require('./open-new-instance')

exports.buildDocMenu = function (prefix) {
  const e = prefix('control')
  return Menu.buildFromTemplate([
    {
      label: e('newWindow'),
      click () {
        console.log(process.argv)
        openNewInstance()
      }
    }
  ])
}

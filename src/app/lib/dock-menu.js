/**
 * app system menu config
 */
const {
  Menu
} = require('electron')
const { spawn } = require('child_process')

function openNewIsntance () {
  const [cmd, ...args] = process.argv
  spawn(cmd, args, {
    cwd: process.cwd()
  })
}

exports.buildDocMenu = function (prefix) {
  const e = prefix('menu')
  return Menu.buildFromTemplate([
    {
      label: e('New Window'),
      click () {
        console.log(process.argv)
        openNewIsntance()
      }
    }
  ])
}

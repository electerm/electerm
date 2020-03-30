/**
 * show file item in folder
 */

const { shell } = require('electron')

module.exports = (path) => {
  console.log('path', path)
  shell.showItemInFolder(path)
}

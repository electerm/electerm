/**
 * show file item in folder
 */

const { shell } = require('electron')

module.exports = (path) => {
  shell.showItemInFolder(path)
}

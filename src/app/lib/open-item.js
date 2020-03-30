/**
 * open folder
 */

const { shell } = require('electron')

module.exports = (path) => {
  shell.openItem(path)
}

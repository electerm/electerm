/**
 * read ssh config
 */

// const { app } = require('electron')
// const home = app.getPath('home')
// const { resolve } = require('path')

function loadSshConfig () {
  const { loadAndConvert } = require('ssh-config-loader')
  return loadAndConvert()
}

module.exports = loadSshConfig

/**
 * read ssh config
 */

// const { app } = require('electron')
// const home = app.getPath('home')
// const { resolve } = require('path')

function loadSshConfig () {
  const { loadAndConvert } = require('ssh-config-loader')
  // const r = loadAndConvert(
  //   resolve(home, '.ssh', 'config')
  // )
  const r = loadAndConvert(
    {
      configPath: '/Users/zxd/dev/ssh-config-loader/test/full-config'
    }
  )
  console.log('ssh config', r)
  return r
}

module.exports = loadSshConfig

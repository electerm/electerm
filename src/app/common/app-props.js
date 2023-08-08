/**
 * app path
 */
const { app } = require('electron')
const constants = require('./runtime-constants')

function getDataPath () {
  const defaultValue = {
    appPath: app.getPath('appData'),
    isPortable: false
  }
  if (!constants.isWin) {
    return defaultValue
  }
  const exePath = app.getPath('exe')
  const p = exePath + '\\' + 'data'
  if (
    require('fs').existsSync(
      p
    )
  ) {
    return {
      appPath: p,
      exePath,
      isPortable: true
    }
  }
  return defaultValue
}

module.exports = {
  ...getDataPath(),
  ...constants
}

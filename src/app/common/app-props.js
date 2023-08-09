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
  const exePath = app.getPath('exe').replace('\\\\electerm.exe', '')
  const p = exePath + '\\' + 'electerm'
  if (
    require('fs').existsSync(
      p
    )
  ) {
    return {
      appPath: exePath,
      exePath,
      isPortable: true
    }
  }
  return {
    ...defaultValue,
    exePath
  }
}

module.exports = {
  ...getDataPath(),
  ...constants
}

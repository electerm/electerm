/**
 * disable some default keyboard shortcuts
 */

const { isMac } = require('../common/runtime-constants')

exports.disableShortCuts = function (win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (
      input.key.toLowerCase() === 'r' &&
      (
        (isMac && input.meta) ||
        (!isMac && input.control && input.shift)
      )
    ) {
      event.preventDefault()
    }
  })
}

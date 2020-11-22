/**
 * system tray
 */

const { Tray } = require('electron')
const { trayIconPath, packInfo, minWindowHeight, minWindowWidth } = require('../utils/constants')
const log = require('../utils/log')

function initTray (menu) {
  const tray = new Tray(trayIconPath)
  tray.setToolTip(packInfo.name)
  tray.setIgnoreDoubleClickEvents(true)
  function onClick () {
    try {
      const [w, h] = global.win.getSize()
      global.win.show()
      if (w < minWindowWidth || h < minWindowHeight) {
        global.win.maximize()
      }
      tray.popUpContextMenu(menu)
    } catch (e) {
      log.error('click tray icon error')
      log.error(e)
    }
  }
  tray.on('click', onClick)
  tray.on('right-click', onClick)
}

module.exports = initTray

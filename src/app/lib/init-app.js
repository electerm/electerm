/**
 * after data loaded, init menu and other things
 */

const {
  Menu,
  Notification
} = require('electron')
const {
  packInfo,
  isMac
} = require('../common/runtime-constants')
const buildMenu = require('./menu')
const { buildDocMenu } = require('./dock-menu')

function capitalizeFirstLetter (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

function initApp (langMap, config) {
  global.et.langMap = langMap
  global.et.getLang = (lang = global.et.config.language || 'en_us') => {
    return global.et.langMap[lang].lang
  }
  global.et.translate = txt => {
    if (global.et.config.language === 'en_us') {
      return capitalizeFirstLetter(
        global.et.getLang()[txt] || txt
      )
    }
    return global.et.getLang()[txt] || txt
  }
  if (isMac) {
    const dockMenu = buildDocMenu()
    global.app.dock.setMenu(dockMenu)
  }
  const menu = buildMenu()
  Menu.setApplicationMenu(menu)
  const e = global.et.translate
  // handle autohide flag
  if (process.argv.includes('--autohide')) {
    global.et.timer = setTimeout(() => global.win.minimize(), 500)
    if (Notification.isSupported()) {
      const notice = new Notification({
        title: `${packInfo.name} ${e('isRunning')}, ${e('press')} ${config.hotkey} ${e('toShow')}`
      })
      notice.show()
    }
  }
}

module.exports = initApp

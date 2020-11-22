/**
 * after data loaded, init menu and other things
 */

const {
  Menu,
  Notification
} = require('electron')
const {
  packInfo
} = require('../utils/constants')
const buildMenu = require('./menu')
const initTray = require('./tray')

function capitalizeFirstLetter (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

function initApp (language, lang, config) {
  global.et.lang = lang
  global.et.language = language
  const prefix = pre => {
    if (global.et.language === 'en_us') {
      return (id) => {
        return capitalizeFirstLetter(global.et.lang[pre][id] || id)
      }
    }
    return (id) => {
      return global.et.lang[pre][id] || id
    }
  }
  const menu = buildMenu(prefix)
  Menu.setApplicationMenu(menu)
  initTray(menu)
  const a = prefix('app')
  // handle autohide flag
  if (process.argv.includes('--autohide')) {
    global.et.timer1 = setTimeout(() => global.win.hide(), 500)
    if (Notification.isSupported()) {
      const notice = new Notification({
        title: `${packInfo.name} ${a('isRunning')}, ${a('press')} ${config.hotkey} ${a('toShow')}`
      })
      notice.show()
    }
  }
}

module.exports = initApp

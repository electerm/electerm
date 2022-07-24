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
  global.et.prefix = pre => {
    if (global.et.config.language === 'en_us') {
      return (id) => {
        return capitalizeFirstLetter(
          global.et.getLang()[pre][id] || id
        )
      }
    }
    return (id) => {
      return global.et.getLang()[pre][id] || id
    }
  }
  if (isMac) {
    const dockMenu = buildDocMenu()
    global.app.dock.setMenu(dockMenu)
  }
  const menu = buildMenu()
  Menu.setApplicationMenu(menu)
  const a = global.et.prefix('app')
  // handle autohide flag
  if (process.argv.includes('--autohide')) {
    global.et.timer = setTimeout(() => global.win.minimize(), 500)
    if (Notification.isSupported()) {
      const notice = new Notification({
        title: `${packInfo.name} ${a('isRunning')}, ${a('press')} ${config.hotkey} ${a('toShow')}`
      })
      notice.show()
    }
  }
}

module.exports = initApp

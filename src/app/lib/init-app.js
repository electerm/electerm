/**
 * after data loaded, init menu and other things
 */

const {
  Menu,
  Notification
} = require('electron')
const globalState = require('./glob-state')
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
  globalState.set('langMap', langMap)
  globalState.set('getLang', (lang = config.language || 'en_us') => {
    return langMap[lang].lang
  })
  globalState.set('translate', txt => {
    const config = globalState.get('config')
    if (config.language === 'en_us') {
      return capitalizeFirstLetter(
        globalState.get('getLang')()[txt] || txt
      )
    }
    return globalState.get('getLang')()[txt] || txt
  })
  if (isMac) {
    const dockMenu = buildDocMenu()
    globalState.get('app').dock.setMenu(dockMenu)
  }
  const menu = buildMenu()
  Menu.setApplicationMenu(menu)
  const e = globalState.get('translate')
  // handle autohide flag
  if (process.argv.includes('--autohide')) {
    globalState.set('timer', setTimeout(() => globalState.get('win').minimize(), 500))
    if (Notification.isSupported()) {
      const notice = new Notification({
        title: `${packInfo.name} ${e('isRunning')}, ${e('press')} ${config.hotkey} ${e('toShow')}`
      })
      notice.show()
    }
  }
}

module.exports = initApp

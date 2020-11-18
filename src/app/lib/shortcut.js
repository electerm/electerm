/**
 * shortcut controll
 */

const log = require('../utils/log')

let shortcut

/**
 * init hotkey
 * @param {object} globalShortcut
 * @param {object} win
 * @param {object} config
 */
exports.initShortCut = (globalShortcut, win, config) => {
  shortcut = config.hotkey
  globalShortcut.register(shortcut, () => {
    if (win.isFocused()) {
      win.hide()
    } else {
      win.show()
    }
  })
  const ok = globalShortcut.isRegistered(shortcut)
  if (!ok) {
    log.warn('shortcut Registration failed.')
  }
}

exports.changeHotkeyReg = (globalShortcut, win) => {
  return newHotkey => {
    globalShortcut.unregister(shortcut)
    globalShortcut.register(newHotkey, () => {
      win.show()
    })
    const ok = globalShortcut.isRegistered(newHotkey)
    if (ok) {
      shortcut = newHotkey
    }
    return ok
  }
}

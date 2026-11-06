/**
 * shortcut controll
 */

const log = require('../common/log')

let shortcut

/**
 * init hotkey
 * @param {object} globalShortcut
 * @param {Function} getFocusedWindow
 * @param {object} config
 */
exports.initShortCut = (globalShortcut, getFocusedWindow, config) => {
  const newShortcut = config.hotkey || ''
  if (shortcut) {
    globalShortcut.unregister(shortcut)
  }
  shortcut = newShortcut
  if (shortcut) {
    globalShortcut.register(shortcut, () => {
      const win = getFocusedWindow()
      if (!win) {
        return
      }
      if (win.isFocused()) {
        win.minimize()
      } else {
        win.restore()
      }
    })
    const ok = globalShortcut.isRegistered(shortcut)
    if (!ok) {
      log.warn('shortcut Registration failed.')
    }
  }
}

exports.changeHotkeyReg = (globalShortcut, getFocusedWindow) => {
  return newHotkey => {
    if (shortcut) {
      globalShortcut.unregister(shortcut)
    }
    if (newHotkey) {
      globalShortcut.register(newHotkey, () => {
        getFocusedWindow()?.show()
      })
      const ok = globalShortcut.isRegistered(newHotkey)
      if (ok) {
        shortcut = newHotkey
      }
      return ok
    } else {
      shortcut = ''
      return true
    }
  }
}

/**
 * shortcut controll
 */

let shortcut

/**
 * init hotkey
 * @param {object} globalShortcut
 * @param {object} win
 * @param {object} config
 */
exports.init = (globalShortcut, win, config) => {
  shortcut = config.hotkey
  globalShortcut.register(shortcut, () => {
    if (win.isFocused()) {
      win.hide()
    }
    else {
      win.show()
    }
  })
  let ok = globalShortcut.isRegistered(shortcut)
  if (!ok) {
    console.log('shortcut Registration failed.')
  }
}

exports.changeHotkeyReg = (globalShortcut, win) => {
  return newHotkey => {
    globalShortcut.unregister(shortcut)
    globalShortcut.register(newHotkey, () => {
      win.show()
    })
    let ok = globalShortcut.isRegistered(newHotkey)
    if (ok) {
      shortcut = newHotkey
    }
    return ok
  }
}

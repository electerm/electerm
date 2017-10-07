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
  shortcut = globalShortcut.register(config.hotkey, () => {
    win.show()
  })

  if (!shortcut) {
    console.log('shortcut Registration failed.')
  }
}

exports.changeHotkeyReg = (globalShortcut, win) => {
  return newHotkey => {
    globalShortcut.unregister(shortcut)
    shortcut = globalShortcut.register(newHotkey, () => {
      win.show()
    })
    return shortcut ? true : false
  }
}

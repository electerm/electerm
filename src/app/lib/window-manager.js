const globalState = require('./glob-state')

const windows = new Map()
const windowStates = new Map()

function isAlive (win) {
  return !!win && (typeof win.isDestroyed !== 'function' || !win.isDestroyed())
}

function getWindows () {
  return Array.from(windows.values()).filter(isAlive)
}

function getFocusedWindow () {
  const focused = getWindows().find(win => {
    return typeof win.isFocused === 'function' && win.isFocused()
  })
  if (focused) {
    return focused
  }
  const current = globalState.get('win')
  if (isAlive(current) && windows.has(current.id)) {
    return current
  }
  const all = getWindows()
  return all[all.length - 1] || null
}

function registerWindow (win, { initialTab = null } = {}) {
  windows.set(win.id, win)
  windowStates.set(win.id, {
    initialTab,
    closeAction: 'closeApp',
    oldRectangle: null
  })
  globalState.set('win', win)
  return win
}

function removeWindow (win) {
  windows.delete(win.id)
  windowStates.delete(win.id)
  if (globalState.get('win') === win) {
    globalState.set('win', null)
    globalState.set('win', getFocusedWindow())
  }
}

function setFocusedWindow (win) {
  if (isAlive(win) && windows.has(win.id)) {
    globalState.set('win', win)
  }
}

function getWindowByWebContents (webContents) {
  return getWindows().find(win => win.webContents === webContents) || null
}

function getWindowState (win) {
  return win ? windowStates.get(win.id) : undefined
}

function consumeInitialTab (win) {
  const state = getWindowState(win)
  if (!state) {
    return null
  }
  const tab = state.initialTab
  state.initialTab = null
  return tab
}

function setCloseAction (win, closeAction) {
  const state = getWindowState(win)
  if (state) {
    state.closeAction = closeAction
  }
}

module.exports = {
  consumeInitialTab,
  getFocusedWindow,
  getWindowByWebContents,
  getWindowState,
  getWindows,
  registerWindow,
  removeWindow,
  setCloseAction,
  setFocusedWindow
}

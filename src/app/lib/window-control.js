/**
 * manage window size save read and set
 */

const lastStateManager = require('./last-state')
const {
  isDev,
  minWindowWidth,
  minWindowHeight
} = require('../common/runtime-constants')
const globalState = require('./glob-state')
const { restoreWindowBounds } = require('./window-restore')

exports.getScreenCurrent = () => {
  const rect = globalState.get('win')
    ? globalState.get('win').getBounds()
    : {
        x: 0,
        y: 0,
        height: minWindowHeight,
        width: minWindowWidth
      }
  const { screen } = require('electron')
  return screen.getDisplayMatching(rect)
}

exports.getScreenSize = () => {
  const screen = exports.getScreenCurrent()
  return {
    ...screen.workAreaSize,
    x: screen.workArea.x,
    y: screen.workArea.y
  }
}

exports.maximize = () => {
  const win = globalState.get('win')
  globalState.set('oldRectangle', win.getBounds())
  win.maximize()
}

exports.unmaximize = () => {
  const oldRectangle = globalState.get('oldRectangle') || {
    width: minWindowWidth,
    height: minWindowHeight,
    x: 200,
    y: 200
  }
  globalState.get('win').unmaximize()
  globalState.get('win').setBounds(oldRectangle)
}

// macOS only. After switching between apps in native fullscreen, the Spaces
// transition can leave the window frame itself stuck at an intermediate
// (about half height) size — no resize event follows, and the terminal keeps
// rendering in the top half. When fullscreen content bounds do not cover the
// screen, snap the window back to the full screen bounds; the resulting
// resize event lets the renderer recover with its normal logic.
exports.repairFullScreenGeometry = () => {
  const win = globalState.get('win')
  if (!win || !win.isFullScreen()) {
    return false
  }
  const { screen } = require('electron')
  const display = screen.getDisplayMatching(win.getBounds())
  const { width, height } = win.getContentBounds()
  const { width: screenWidth, height: screenHeight } = display.bounds
  // Small tolerance for the menu bar / rounding on some displays.
  if (width >= screenWidth - 2 && height >= screenHeight - 2) {
    return false
  }
  win.setBounds(display.bounds)
  return true
}

exports.getWindowSize = async () => {
  return exports.getWindowSizeDep()
}

exports.getWindowSizeDep = async () => {
  const windowSizeLastState = await lastStateManager.get('windowSize')
  const windowPosLastState = await lastStateManager.get('windowPos')
  const { screen } = require('electron')
  return restoreWindowBounds({
    screen,
    windowSizeLastState,
    windowPosLastState,
    isDev,
    minWindowWidth,
    minWindowHeight
  })
}

exports.setWindowPos = (pos) => {
  lastStateManager.set('windowPos', pos)
}

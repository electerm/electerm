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

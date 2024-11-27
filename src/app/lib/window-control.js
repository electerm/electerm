/**
 * manage window size save read and set
 */

const lastStateManager = require('./last-state')
const {
  isDev,
  minWindowWidth,
  minWindowHeight,
  isLinux
} = require('../common/runtime-constants')
const globalState = require('./glob-state')

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
  const p = exports.getScreenCurrent()
  const {
    width, height, x, y
  } = p.workArea

  win.setPosition(x, y)
  win.setSize(width, height)
}

exports.unmaximize = () => {
  const oldRectangle = globalState.get('oldRectangle') || {
    width: minWindowWidth,
    height: minWindowHeight,
    x: 200,
    y: 200
  }
  globalState.get('win').setBounds(oldRectangle)
}

exports.getWindowSize = async () => {
  const rect = await exports.getWindowSizeDep()
  if (!isLinux) {
    return rect
  }
  const {
    width,
    height
  } = exports.getScreenSize()
  if (rect.width >= width - 200) {
    rect.width = width - 200
    rect.x = 100
  }
  if (rect.height >= height - 200) {
    rect.height = height - 200
    rect.y = 100
  }
  return rect
}

exports.getWindowSizeDep = async () => {
  const windowSizeLastState = await lastStateManager.get('windowSize')
  const windowPosLastState = await lastStateManager.get('windowPos')
  const {
    width: maxWidth,
    height: maxHeight
  } = exports.getScreenSize()
  if (!windowSizeLastState || isDev) {
    return {
      width: maxWidth,
      height: maxHeight,
      x: 0,
      y: 0
    }
  }
  const {
    innerWidth,
    height,
    screenHeight,
    screenWidth
  } = windowSizeLastState
  const fw = innerWidth / screenWidth
  const fh = height / screenHeight
  let w = maxWidth * fw
  let h = maxHeight * fh
  const minW = minWindowWidth
  const minH = minWindowHeight
  if (w < minW) {
    w = minW
  }
  if (h < minH) {
    h = minH
  }
  let {
    x = 0,
    y = 0
  } = windowPosLastState || {}
  if (x < 0 || x > maxWidth - 100) {
    x = 0
  }
  if (y < 0 || y > maxHeight - 100) {
    y = 0
  }
  return {
    width: w,
    height: h,
    x,
    y
  }
}

exports.setWindowPos = (pos) => {
  lastStateManager.set('windowPos', pos)
}

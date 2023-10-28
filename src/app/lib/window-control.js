/**
 * manage window size save read and set
 */

const lastStateManager = require('./last-state')
// const log = require('./log')
const { isDev, minWindowWidth, minWindowHeight } = require('../common/runtime-constants')

exports.getScreenCurrent = () => {
  const rect = global.win
    ? global.win.getBounds()
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
  global.oldRectangle = global.win.getBounds()
  // global.win.setPosition(0, 0)
  const p = exports.getScreenCurrent()
  const {
    width, height, x, y
  } = p.workArea
  global.win.setPosition(x, y)
  global.win.setSize(width, height)
}

exports.unmaximize = () => {
  const {
    oldRectangle = {
      width: minWindowWidth,
      height: minWindowHeight,
      x: 0,
      y: 0
    }
  } = global
  global.win.setPosition(oldRectangle.x, oldRectangle.y)
  global.win.setSize(oldRectangle.width, oldRectangle.height)
}

exports.getWindowSize = async () => {
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
  const {
    x = 0,
    y = 0
  } = windowPosLastState || {}
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

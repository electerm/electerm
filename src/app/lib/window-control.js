/**
 * manage window size save read and set
 */

const lastStateManager = require('./last-state')
// const log = require('./log')
const { isDev, minWindowWidth, minWindowHeight } = require('../utils/constants')

exports.getScreenPrimary = () => {
  return require('electron').screen.getPrimaryDisplay()
}

exports.getScreenSize = () => {
  return exports.getScreenPrimary().workAreaSize
}

exports.maximize = () => {
  global.oldRectangle = global.win.getBounds()
  global.win.setPosition(0, 0)
  const p = exports.getScreenPrimary()
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
  const {
    width: maxWidth,
    height: maxHeight
  } = exports.getScreenSize()
  if (!windowSizeLastState || isDev) {
    return {
      width: maxWidth,
      height: maxHeight
    }
  }
  const {
    width,
    height,
    screenHeight,
    screenWidth
  } = windowSizeLastState
  const fw = width / screenWidth
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
  return {
    width: w,
    height: h
  }
}

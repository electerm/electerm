/**
 * manage window size save read and set
 */

const lastStateManager = require('../lib/last-state')
// const log = require('./log')
const { isDev, minWindowWidth, minWindowHeight } = require('./app-props')

exports.getScreenSize = () => {
  return require('electron').screen.getPrimaryDisplay().workAreaSize
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

/**
 * manage window size save read and set
 */

const lastStateManager = require('../lib/last-state')
const log = require('./log')
const { isDev } = require('./app-props')

exports.getScreenSize = () => {
  return require('electron').screen.getPrimaryDisplay().workAreaSize
}

exports.getWindowSize = () => {
  const windowSizeLastState = lastStateManager.get('windowSize')
  const {
    width: maxWidth,
    height: maxHeight
  } = exports.getScreenSize()
  log.info('max width', maxWidth)
  log.info('max height', maxHeight)
  // if (!windowSizeLastState || isDev) {
  //   return {
  //     width: maxWidth,
  //     height: maxHeight
  //   }
  // }
  const {
    width,
    height,
    screenHeight,
    screenWidth
  } = windowSizeLastState
  const fw = width / screenWidth
  const fh = height / screenHeight
  log.info('f', fw, fh, width,
  height,
  screenHeight,
  screenWidth)
  let w = maxWidth * fw
  let h = maxHeight * fh
  const minW = 590
  const minH = 400
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

/**
 * BrowserWindow chrome for the three title bar modes electerm can run in.
 * Pure — the platform is passed in — so it can be unit tested outside Electron.
 */

const windowBackground = '#333333'

function getTitleBarOptions (useSystemTitleBar, isWin) {
  // Keep Windows caption hit testing outside the web content, including at
  // non-default DPI and when a settings panel covers the session tabs.
  if (!isWin && !useSystemTitleBar) {
    return {
      frame: false,
      transparent: true,
      titleBarStyle: 'hidden'
    }
  }
  return {
    frame: true,
    transparent: false,
    titleBarStyle: 'default'
  }
}

module.exports = {
  getTitleBarOptions,
  windowBackground
}

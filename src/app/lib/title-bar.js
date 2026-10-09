/**
 * BrowserWindow chrome for the three title bar modes electerm can run in.
 * Pure — the platform is passed in — so it can be unit tested outside Electron.
 */

// The window's own background (backgroundColor in create-window.js). The
// overlay colors below are the first paint, before the renderer recolors them,
// so they match it to avoid a dark caption strip flashing on light themes.
const windowBackground = '#333333'

// must match the .tabs height in components/tabs/tabs.styl
const titleBarOverlayHeight = 36

/**
 * Options deciding what the window's title bar looks like.
 *
 * - Windows: always the native frame plus the window controls overlay.
 *   `useSystemTitleBar` is ignored here: the frameless/transparent alternative
 *   gives up the resize border, shadow and Aero Snap / Snap Layouts and needs
 *   manual move/resize, so the system frame is always the better choice.
 *   `titleBarStyle: 'hidden'` makes the window frameless even though `frame` is
 *   true (Electron computes `has_frame_` as `frame && title_bar_style_ ==
 *   kNormal`), so there is no caption strip. What survives is the thick frame —
 *   resize border, shadow, Aero Snap / Snap Layouts — plus the native
 *   min/max/close, which Windows draws over the tab bar through
 *   `titleBarOverlay`. The renderer recolors them from the UI theme
 *   (setTitleBarOverlay, see components/main/title-bar-overlay.js).
 * - no system title bar, macOS/Linux: frameless and transparent, electerm draws
 *   its own title bar and window controls in the tab bar
 * - system title bar, macOS/Linux: a real frame with the native title bar
 *
 * @param {boolean} useSystemTitleBar ignored on Windows
 * @param {boolean} isWin
 * @returns {object} BrowserWindow options
 */
function getTitleBarOptions (useSystemTitleBar, isWin) {
  if (isWin) {
    return {
      frame: true,
      transparent: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: windowBackground,
        symbolColor: '#dddddd',
        height: titleBarOverlayHeight
      }
    }
  }
  if (!useSystemTitleBar) {
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

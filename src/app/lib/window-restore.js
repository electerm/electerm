const minVisibleSize = 100

function clamp (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function finiteOr (value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

function limitWindowSize (savedSize, savedScreenSize, workAreaSize, minSize) {
  const ratio = savedSize / savedScreenSize
  const restoredSize = Number.isFinite(ratio) && ratio > 0
    ? workAreaSize * ratio
    : workAreaSize
  return Math.min(Math.max(Math.round(restoredSize), minSize), workAreaSize)
}

function limitWindowPosition (position, workAreaPosition, workAreaSize, windowSize) {
  const visibleSize = Math.min(minVisibleSize, windowSize, workAreaSize)
  const min = workAreaPosition - windowSize + visibleSize
  const max = workAreaPosition + workAreaSize - visibleSize
  return clamp(position, min, max)
}

function isBoundsVisibleOnAnyDisplay (bounds, displays) {
  return displays.some(display => {
    const { workArea } = display
    const visibleLeft = Math.max(bounds.x, workArea.x)
    const visibleRight = Math.min(bounds.x + bounds.width, workArea.x + workArea.width)
    const visibleTop = Math.max(bounds.y, workArea.y)
    const visibleBottom = Math.min(bounds.y + bounds.height, workArea.y + workArea.height)
    return visibleRight - visibleLeft >= minVisibleSize &&
      visibleBottom - visibleTop >= minVisibleSize
  })
}

/**
 * Check whether a given point (x, y) falls within the work area of
 * any of the provided displays. This is used to detect whether the
 * saved window position still refers to a connected monitor.
 */
function isPointOnAnyDisplay (point, displays) {
  return displays.some(display => {
    const { workArea } = display
    return point.x >= workArea.x &&
      point.x < workArea.x + workArea.width &&
      point.y >= workArea.y &&
      point.y < workArea.y + workArea.height
  })
}

exports.isBoundsVisibleOnAnyDisplay = isBoundsVisibleOnAnyDisplay
exports.isPointOnAnyDisplay = isPointOnAnyDisplay

/**
 * Safety net: after a window is created, verify it is actually visible
 * on at least one currently-connected display. Electron may adjust the
 * requested bounds, or the display configuration may have changed between
 * getWindowSize() and window creation. If the window ends up off-screen
 * (e.g. saved position was on a monitor that has since been unplugged),
 * move it to the primary display so the user can always see and interact
 * with the app.
 *
 * Two conditions are checked:
 *   1. At least 100px of the window is visible on some display
 *      (catches windows that are completely off-screen).
 *   2. The centre point of the window is on some display
 *      (catches windows that are only barely visible at the edge
 *      of a display, e.g. only a 100px sliver — which is technically
 *      "visible" but practically unusable to the user).
 * If either condition fails, move the window to the primary display.
 *
 * @param {import('electron').BrowserWindow} win
 * @param {import('electron').Screen} screen
 */
exports.ensureWindowVisible = function (win, screen) {
  const allDisplays = screen.getAllDisplays()
  const actualBounds = win.getBounds()
  const centerX = actualBounds.x + Math.floor(actualBounds.width / 2)
  const centerY = actualBounds.y + Math.floor(actualBounds.height / 2)
  const centerOnDisplay = isPointOnAnyDisplay({ x: centerX, y: centerY }, allDisplays)
  const boundsVisible = isBoundsVisibleOnAnyDisplay(actualBounds, allDisplays)
  if (!centerOnDisplay || !boundsVisible) {
    const { workArea } = screen.getPrimaryDisplay()
    win.setBounds({
      x: workArea.x,
      y: workArea.y,
      width: Math.min(actualBounds.width, workArea.width),
      height: Math.min(actualBounds.height, workArea.height)
    })
  }
}

exports.restoreWindowBounds = ({
  screen,
  windowSizeLastState,
  windowPosLastState,
  isDev,
  minWindowWidth,
  minWindowHeight
}) => {
  const defaultBounds = {
    x: 0,
    y: 0,
    width: minWindowWidth,
    height: minWindowHeight
  }

  if (!windowSizeLastState || isDev) {
    const { workArea } = screen.getDisplayMatching(defaultBounds)
    return {
      width: workArea.width,
      height: workArea.height,
      x: 0,
      y: 0
    }
  }

  const savedPosition = {
    x: finiteOr(windowPosLastState && windowPosLastState.x, 0),
    y: finiteOr(windowPosLastState && windowPosLastState.y, 0)
  }

  const allDisplays = screen.getAllDisplays()

  // Determine whether the saved window position still falls within a
  // currently connected display. When the monitor the window was last on
  // has been disconnected, the saved position will be outside all connected
  // displays. In that case we must NOT simply clamp the old position to the
  // edge of the nearest display (which would leave the window almost
  // entirely off-screen with only a tiny sliver visible). Instead we
  // centre the window on the primary display so the user can always find
  // and interact with it.
  const savedPositionIsValid = isPointOnAnyDisplay(savedPosition, allDisplays)

  // Electron reports display bounds and window positions in DIP coordinates.
  const targetDisplay = savedPositionIsValid
    ? screen.getDisplayNearestPoint(savedPosition)
    : screen.getPrimaryDisplay()
  const { workArea } = targetDisplay
  const width = limitWindowSize(
    windowSizeLastState.innerWidth,
    windowSizeLastState.screenWidth,
    workArea.width,
    minWindowWidth
  )
  const height = limitWindowSize(
    windowSizeLastState.height,
    windowSizeLastState.screenHeight,
    workArea.height,
    minWindowHeight
  )

  let bounds
  if (savedPositionIsValid) {
    // The monitor the window was last on is still connected — restore
    // the saved position, clamped so at least part of the window is visible.
    bounds = {
      width,
      height,
      x: limitWindowPosition(
        savedPosition.x,
        workArea.x,
        workArea.width,
        width
      ),
      y: limitWindowPosition(
        savedPosition.y,
        workArea.y,
        workArea.height,
        height
      )
    }
  } else {
    // The saved position is on a disconnected monitor. Centre the
    // window on the primary display so it is fully visible.
    bounds = {
      width,
      height,
      x: workArea.x + Math.floor((workArea.width - width) / 2),
      y: workArea.y + Math.floor((workArea.height - height) / 2)
    }
  }

  // Safety net: verify the computed bounds are actually visible on at
  // least one currently-connected display. This catches edge cases where
  // the display returned by getDisplayNearestPoint is stale — for example
  // an external monitor was disconnected but Electron has not yet updated
  // its internal display list — or where the workArea has changed since
  // the display was queried. Without this check the window could end up
  // on a non-existent display and be completely invisible to the user.
  if (!isBoundsVisibleOnAnyDisplay(bounds, allDisplays)) {
    const primary = screen.getPrimaryDisplay()
    const { workArea: primaryWorkArea } = primary
    return {
      width: Math.min(width, primaryWorkArea.width),
      height: Math.min(height, primaryWorkArea.height),
      x: primaryWorkArea.x,
      y: primaryWorkArea.y
    }
  }

  return bounds
}

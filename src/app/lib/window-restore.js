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

exports.isBoundsVisibleOnAnyDisplay = isBoundsVisibleOnAnyDisplay

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
  // Electron reports display bounds and window positions in DIP coordinates.
  const { workArea } = screen.getDisplayNearestPoint(savedPosition)
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

  const bounds = {
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

  // Safety net: verify the computed bounds are actually visible on at
  // least one currently-connected display. This catches edge cases where
  // the display returned by getDisplayNearestPoint is stale — for example
  // an external monitor was disconnected but Electron has not yet updated
  // its internal display list — or where the workArea has changed since
  // the display was queried. Without this check the window could end up
  // on a non-existent display and be completely invisible to the user.
  const allDisplays = screen.getAllDisplays()
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

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

  return {
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
}

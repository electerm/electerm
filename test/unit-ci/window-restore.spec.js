const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  restoreWindowBounds,
  isBoundsVisibleOnAnyDisplay
} = require('../../src/app/lib/window-restore')

const minWindowWidth = 590
const minWindowHeight = 400

function distanceFromRange (value, start, size) {
  const end = start + size
  if (value < start) {
    return start - value
  }
  if (value > end) {
    return value - end
  }
  return 0
}

function createScreen (displays, options = {}) {
  const calls = {
    matching: [],
    nearestPoint: [],
    allDisplays: 0,
    primaryDisplay: 0
  }
  // When simulating a stale display, getDisplayNearestPoint returns a
  // display that is no longer in the active displays list returned by
  // getAllDisplays.
  const staleDisplay = options.staleDisplay
  return {
    calls,
    getDisplayMatching (rect) {
      calls.matching.push(rect)
      return displays.reduce((best, display) => {
        const xOverlap = Math.max(0, Math.min(
          rect.x + rect.width,
          display.bounds.x + display.bounds.width
        ) - Math.max(rect.x, display.bounds.x))
        const yOverlap = Math.max(0, Math.min(
          rect.y + rect.height,
          display.bounds.y + display.bounds.height
        ) - Math.max(rect.y, display.bounds.y))
        const overlap = xOverlap * yOverlap
        return !best || overlap > best.overlap
          ? { display, overlap }
          : best
      }, null).display
    },
    getDisplayNearestPoint (point) {
      calls.nearestPoint.push(point)
      if (staleDisplay) {
        return staleDisplay
      }
      return displays.reduce((best, display) => {
        const xDistance = distanceFromRange(
          point.x,
          display.bounds.x,
          display.bounds.width
        )
        const yDistance = distanceFromRange(
          point.y,
          display.bounds.y,
          display.bounds.height
        )
        const distance = Math.hypot(xDistance, yDistance)
        return !best || distance < best.distance
          ? { display, distance }
          : best
      }, null).display
    },
    getAllDisplays () {
      calls.allDisplays++
      return displays
    },
    getPrimaryDisplay () {
      calls.primaryDisplay++
      return displays[0]
    }
  }
}

function display ({
  x,
  y,
  width,
  height,
  workArea = { x, y, width, height },
  scaleFactor = 1
}) {
  return {
    bounds: { x, y, width, height },
    workArea,
    scaleFactor
  }
}

function savedSize ({
  width = 1000,
  height = 700,
  screenWidth,
  screenHeight
}) {
  return {
    innerWidth: width,
    height,
    screenWidth,
    screenHeight
  }
}

function restore ({
  displays,
  windowSizeLastState,
  windowPosLastState,
  isDev = false,
  staleDisplay
}) {
  const screen = createScreen(displays, { staleDisplay })
  const bounds = restoreWindowBounds({
    screen,
    windowSizeLastState,
    windowPosLastState,
    isDev,
    minWindowWidth,
    minWindowHeight
  })
  return { bounds, screen }
}

describe('window bounds restoration', () => {
  it('uses the matching display work area on first launch', () => {
    const primary = display({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }
    })
    const { bounds, screen } = restore({
      displays: [primary]
    })

    assert.deepEqual(bounds, {
      width: 1920,
      height: 1040,
      x: 0,
      y: 0
    })
    assert.equal(screen.calls.matching.length, 1)
    assert.equal(screen.calls.nearestPoint.length, 0)
  })

  it('restores a window on the second display', () => {
    const displays = [
      display({ x: 0, y: 0, width: 1920, height: 1080 }),
      display({ x: 1920, y: 0, width: 1920, height: 1080 })
    ]
    const { bounds, screen } = restore({
      displays,
      windowSizeLastState: savedSize({
        screenWidth: 1920,
        screenHeight: 1080
      }),
      windowPosLastState: { x: 2100, y: 120 }
    })

    assert.deepEqual(bounds, {
      width: 1000,
      height: 700,
      x: 2100,
      y: 120
    })
    assert.deepEqual(screen.calls.nearestPoint, [{ x: 2100, y: 120 }])
  })

  it('uses the second display resolution when restoring its size', () => {
    const displays = [
      display({ x: 0, y: 0, width: 2560, height: 1440 }),
      display({
        x: 2560,
        y: 240,
        width: 1280,
        height: 1024,
        workArea: { x: 2560, y: 240, width: 1280, height: 984 }
      })
    ]
    const { bounds } = restore({
      displays,
      windowSizeLastState: savedSize({
        width: 1000,
        height: 700,
        screenWidth: 1280,
        screenHeight: 984
      }),
      windowPosLastState: { x: 2700, y: 300 }
    })

    assert.deepEqual(bounds, {
      width: 1000,
      height: 700,
      x: 2700,
      y: 300
    })
  })

  it('uses work area coordinates reported for a differently scaled display', () => {
    const displays = [
      display({
        x: 0,
        y: 0,
        width: 2048,
        height: 1280,
        scaleFactor: 1
      }),
      display({
        x: 2048,
        y: 416,
        width: 1536,
        height: 864,
        scaleFactor: 1.25
      })
    ]
    const { bounds } = restore({
      displays,
      windowSizeLastState: savedSize({
        width: 1494,
        height: 864,
        screenWidth: 1536,
        screenHeight: 864
      }),
      windowPosLastState: { x: 2090, y: 416 }
    })

    assert.deepEqual(bounds, {
      width: 1494,
      height: 864,
      x: 2090,
      y: 416
    })
  })

  it('preserves negative x coordinates for a display left of the primary', () => {
    const displays = [
      display({ x: -1920, y: 0, width: 1920, height: 1080 }),
      display({ x: 0, y: 0, width: 2560, height: 1440 })
    ]
    const { bounds } = restore({
      displays,
      windowSizeLastState: savedSize({
        screenWidth: 1920,
        screenHeight: 1080
      }),
      windowPosLastState: { x: -1600, y: 120 }
    })

    assert.deepEqual(bounds, {
      width: 1000,
      height: 700,
      x: -1600,
      y: 120
    })
  })

  it('preserves negative y coordinates for a display above the primary', () => {
    const displays = [
      display({ x: 0, y: -1080, width: 1920, height: 1080 }),
      display({ x: 0, y: 0, width: 1920, height: 1080 })
    ]
    const { bounds } = restore({
      displays,
      windowSizeLastState: savedSize({
        screenWidth: 1920,
        screenHeight: 1080
      }),
      windowPosLastState: { x: 200, y: -900 }
    })

    assert.deepEqual(bounds, {
      width: 1000,
      height: 700,
      x: 200,
      y: -900
    })
  })

  it('centres the window on the primary display when the saved position is off-screen', () => {
    const primary = display({ x: 0, y: 0, width: 1920, height: 1080 })
    const { bounds } = restore({
      displays: [primary],
      windowSizeLastState: savedSize({
        screenWidth: 1920,
        screenHeight: 1080
      }),
      windowPosLastState: { x: 2500, y: 1400 }
    })

    assert.deepEqual(bounds, {
      width: 1000,
      height: 700,
      x: 460,
      y: 190
    })
  })

  it('does not shrink a nearly full-screen normal window by 200 pixels', () => {
    const primary = display({ x: 0, y: 0, width: 1536, height: 864 })
    const { bounds } = restore({
      displays: [primary],
      windowSizeLastState: savedSize({
        width: 1494,
        height: 864,
        screenWidth: 1536,
        screenHeight: 864
      }),
      windowPosLastState: { x: 20, y: 0 }
    })

    assert.deepEqual(bounds, {
      width: 1494,
      height: 864,
      x: 20,
      y: 0
    })
  })

  it('raises saved sizes below the configured minimums', () => {
    const primary = display({ x: 0, y: 0, width: 1920, height: 1080 })
    const { bounds } = restore({
      displays: [primary],
      windowSizeLastState: savedSize({
        width: 200,
        height: 100,
        screenWidth: 1920,
        screenHeight: 1080
      }),
      windowPosLastState: { x: 50, y: 50 }
    })

    assert.deepEqual(bounds, {
      width: minWindowWidth,
      height: minWindowHeight,
      x: 50,
      y: 50
    })
  })

  it('limits an oversized saved window to the target work area', () => {
    const primary = display({
      x: 100,
      y: 50,
      width: 1600,
      height: 1000,
      workArea: { x: 100, y: 80, width: 1600, height: 920 }
    })
    const { bounds } = restore({
      displays: [primary],
      windowSizeLastState: savedSize({
        width: 2200,
        height: 1400,
        screenWidth: 1600,
        screenHeight: 920
      }),
      windowPosLastState: { x: 100, y: 80 }
    })

    assert.deepEqual(bounds, {
      width: 1600,
      height: 920,
      x: 100,
      y: 80
    })
  })

  it('falls back to the primary display when the nearest display is stale', () => {
    // Simulate a race condition: the saved window position is on the
    // primary display, but getDisplayNearestPoint returns a stale
    // display that has since been disconnected and is far off-screen.
    // The clamped bounds end up off-screen, so the safety net must
    // fall back to the primary display.
    const primary = display({ x: 0, y: 0, width: 1920, height: 1080 })
    const stale = display({
      x: 5000,
      y: 5000,
      width: 1920,
      height: 1080
    })

    const { bounds, screen } = restore({
      displays: [primary],
      staleDisplay: stale,
      windowSizeLastState: savedSize({
        screenWidth: 1920,
        screenHeight: 1080
      }),
      windowPosLastState: { x: 100, y: 100 }
    })

    // The computed bounds would be on the stale (disconnected) display,
    // so the safety check should fall back to the primary display's work area.
    assert.deepEqual(bounds, {
      width: 1000,
      height: 700,
      x: 0,
      y: 0
    })
    assert.equal(screen.calls.allDisplays, 1)
    assert.equal(screen.calls.primaryDisplay, 1)
  })

  it('falls back to the primary display when the work area has shrunk since the display was queried', () => {
    // Simulate a race condition: getDisplayNearestPoint returns a display
    // with a large work area (e.g. before the dock was resized), but
    // getAllDisplays reports the same display with a tiny work area.
    // The clamped bounds are visible in the large work area but not in
    // the shrunk one, so the safety net must kick in.
    const largeWorkArea = display({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    })
    const shrunkWorkArea = display({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      workArea: { x: 0, y: 0, width: 50, height: 50 }
    })

    const customScreen = {
      getDisplayMatching: () => largeWorkArea,
      getDisplayNearestPoint: () => largeWorkArea,
      getAllDisplays: () => [shrunkWorkArea],
      getPrimaryDisplay: () => shrunkWorkArea
    }

    const bounds = restoreWindowBounds({
      screen: customScreen,
      windowSizeLastState: savedSize({
        screenWidth: 1920,
        screenHeight: 1080
      }),
      windowPosLastState: { x: 500, y: 500 },
      isDev: false,
      minWindowWidth,
      minWindowHeight
    })

    // The computed bounds (1000x700) are visible in the large work area
    // but not in the shrunk one (50x50). The safety net falls back to
    // the primary display's (shrunk) work area.
    assert.deepEqual(bounds, {
      width: 50,
      height: 50,
      x: 0,
      y: 0
    })
  })

  it('isBoundsVisibleOnAnyDisplay returns true for a fully visible window', () => {
    const primary = display({ x: 0, y: 0, width: 1920, height: 1080 })
    assert.equal(
      isBoundsVisibleOnAnyDisplay(
        { x: 100, y: 100, width: 800, height: 600 },
        [primary]
      ),
      true
    )
  })

  it('isBoundsVisibleOnAnyDisplay returns false for an off-screen window', () => {
    const primary = display({ x: 0, y: 0, width: 1920, height: 1080 })
    assert.equal(
      isBoundsVisibleOnAnyDisplay(
        { x: 3000, y: 3000, width: 800, height: 600 },
        [primary]
      ),
      false
    )
  })

  it('isBoundsVisibleOnAnyDisplay returns true when visible on the second display', () => {
    const displays = [
      display({ x: 0, y: 0, width: 1920, height: 1080 }),
      display({ x: 1920, y: 0, width: 1920, height: 1080 })
    ]
    assert.equal(
      isBoundsVisibleOnAnyDisplay(
        { x: 2100, y: 100, width: 800, height: 600 },
        displays
      ),
      true
    )
  })
})

const { afterEach, describe, it } = require('node:test')
const assert = require('node:assert/strict')
const globalState = require('../../app/lib/glob-state')
const {
  consumeInitialTab,
  getFocusedWindow,
  getWindowByWebContents,
  getWindowState,
  getWindows,
  registerWindow,
  removeWindow,
  setCloseAction,
  setFocusedWindow
} = require('../../app/lib/window-manager')

const registered = []
let nextId = 1

function createWindow (options) {
  const win = {
    id: nextId++,
    webContents: {},
    destroyed: false,
    focused: false,
    isDestroyed () {
      return this.destroyed
    },
    isFocused () {
      return this.focused
    }
  }
  registered.push(registerWindow(win, options))
  return win
}

afterEach(() => {
  for (const win of registered.splice(0)) {
    win.destroyed = true
    removeWindow(win)
  }
  globalState.set('win', null)
})

describe('application window registry', () => {
  it('routes webContents to their own application window only', () => {
    const first = createWindow()
    const second = createWindow()

    assert.deepEqual(getWindows(), [first, second])
    assert.equal(getWindowByWebContents(first.webContents), first)
    assert.equal(getWindowByWebContents(second.webContents), second)
    assert.equal(getWindowByWebContents({}), null)
  })

  it('tracks focus and falls back to a remaining window on close', () => {
    const first = createWindow()
    const second = createWindow()
    first.focused = true
    setFocusedWindow(first)
    assert.equal(getFocusedWindow(), first)

    first.focused = false
    second.focused = true
    setFocusedWindow(second)
    assert.equal(getFocusedWindow(), second)

    second.destroyed = true
    removeWindow(second)
    assert.equal(getFocusedWindow(), first)
    assert.equal(globalState.get('win'), first)
  })

  it('consumes initial tab data once for the intended window', () => {
    const tab = { id: 'detached-tab', title: 'remote' }
    const first = createWindow({ initialTab: tab })
    const second = createWindow()

    assert.equal(consumeInitialTab(second), null)
    assert.equal(consumeInitialTab(first), tab)
    assert.equal(consumeInitialTab(first), null)
  })

  it('keeps close and restore state independent between windows', () => {
    const first = createWindow()
    const second = createWindow()
    const bounds = { x: 20, y: 30, width: 900, height: 700 }

    getWindowState(first).oldRectangle = bounds
    setCloseAction(first, 'exit')

    assert.equal(getWindowState(first).oldRectangle, bounds)
    assert.equal(getWindowState(first).closeAction, 'exit')
    assert.equal(getWindowState(second).oldRectangle, null)
    assert.equal(getWindowState(second).closeAction, 'closeApp')
  })
})

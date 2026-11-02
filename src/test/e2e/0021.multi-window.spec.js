const { _electron: electron, test, expect } = require('@playwright/test')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const appOptions = require('./common/app-options')

test.setTimeout(90000)

test('windows own their tabs and bounds, and dragging a tab outside opens a new window', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'electerm-multi-window-'))
  const env = { ...appOptions.env, DATA_PATH: dataDir }
  const args = [
    resolve(__dirname, 'common/multi-window-app.js'),
    ...appOptions.args.slice(1)
  ]
  let app
  try {
    app = await electron.launch({ ...appOptions, env, args })
    const first = await app.firstWindow()
    await first.waitForFunction(() => window.store?.configLoaded && window.store.tabs.length)
    const firstWindowId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id)

    const secondWindow = app.waitForEvent('window')
    const accelerator = await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu().items
        .flatMap(menuItem => menuItem.submenu?.items || [])
        .find(menuItem => menuItem.accelerator === 'CmdOrCtrl+N')
      if (!item) {
        throw new Error('New Window menu accelerator is not registered')
      }
      item.click()
      return item.accelerator
    })
    expect(accelerator).toBe('CmdOrCtrl+N')
    const second = await secondWindow
    await second.waitForFunction(() => window.store?.configLoaded && window.store.tabs.length)
    expect(app.windows()).toHaveLength(2)

    await first.evaluate(() => {
      const { store } = window
      store.updateTab(store.activeTabId, { title: 'first-window-tab' })
    })
    await second.evaluate(() => {
      const { store } = window
      store.updateTab(store.activeTabId, { title: 'second-window-tab' })
      store.addTab({ title: 'second-only-tab' })
    })
    await expect(first.locator('.v1 .tab')).toHaveCount(1)
    await expect(second.locator('.v1 .tab')).toHaveCount(2)
    expect(await first.evaluate(() => window.store.tabs.some(tab => tab.title === 'second-only-tab'))).toBe(false)
    expect(await second.evaluate(() => window.store.tabs.some(tab => tab.title === 'first-window-tab'))).toBe(false)

    await app.evaluate(({ BrowserWindow }, id) => {
      const windows = BrowserWindow.getAllWindows()
      const firstWin = windows.find(win => win.id === id)
      const secondWin = windows.find(win => win.id !== id)
      firstWin.setBounds({ x: 60, y: 50, width: 1000, height: 700 })
      secondWin.setBounds({ x: 120, y: 90, width: 940, height: 660 })
    }, firstWindowId)
    await expect.poll(() => first.evaluate(() => window.outerWidth)).toBe(1000)
    await expect.poll(() => second.evaluate(() => window.outerWidth)).toBe(940)
    expect(await first.evaluate(() => window.outerHeight)).toBe(700)
    expect(await second.evaluate(() => window.outerHeight)).toBe(660)

    const secondClosed = second.waitForEvent('close')
    await second.evaluate(() => {
      window.pre.runGlobalAsync('closeApp', 'exit')
    })
    await secondClosed
    expect(app.windows()).toHaveLength(1)
    await expect(first.locator('.session-current .xterm').first()).toBeVisible()

    const movedTitle = 'detach-me'
    await first.evaluate(title => {
      window.store.addTab({ title })
    }, movedTitle)
    await expect(first.locator('.v1 .tab')).toHaveCount(2)
    const detachedWindow = app.waitForEvent('window')
    await first.locator('.v1 .tab').filter({ hasText: movedTitle }).evaluate(el => {
      const dataTransfer = new window.DataTransfer()
      dataTransfer.dropEffect = 'none'
      el.dispatchEvent(new window.DragEvent('dragend', {
        bubbles: true,
        dataTransfer,
        screenX: window.screenX + window.outerWidth + 100,
        screenY: window.screenY + 100
      }))
    })
    const detached = await detachedWindow
    await detached.waitForFunction(() => window.store?.configLoaded && window.store.tabs.length)
    await expect(first.locator('.v1 .tab')).toHaveCount(1)
    await expect(detached.locator('.v1 .tab')).toHaveCount(1)
    await expect(detached.locator('.v1 .tab').first()).toContainText(movedTitle)
    expect(await detached.evaluate(() => window.store.tabs.length)).toBe(1)
  } finally {
    if (app) {
      await app.close()
    }
    rmSync(dataDir, { recursive: true, force: true })
  }
})

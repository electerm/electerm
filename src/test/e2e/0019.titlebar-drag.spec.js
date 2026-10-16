const { _electron: electron, test, expect } = require('@playwright/test')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')

const HTCLIENT = 1
const HTCAPTION = 2
const HTMAXBUTTON = 9

test('Windows keeps the empty titlebar draggable next to a tab with a long title', async () => {
  test.skip(process.platform !== 'win32', 'Windows native caption hit testing')
  test.setTimeout(60000)
  // Its own app name and data dir, so it runs beside an open electerm
  const dataDir = mkdtempSync(join(tmpdir(), 'electerm-titlebar-'))
  const env = { ...process.env, DATA_PATH: dataDir, NODE_TEST: 'yes' }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    env,
    args: [resolve(__dirname, 'common/titlebar-app.js')]
  })
  try {
    const page = await app.firstWindow()
    await page.waitForFunction(() => window.store?.configLoaded && window.store.tabs.length)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setBounds({ x: 100, y: 100, width: 1062, height: 793 })
    })
    await page.waitForFunction(() => document.querySelector('.wco .tabs .tab'))

    // A title much wider than the 200px tab, which clips it with an ellipsis
    await page.evaluate(() => {
      const { store } = window
      store.updateTab(store.activeTabId, { title: 'a long tab title '.repeat(8) })
    })
    const addBtn = page.locator('.tabs-inner .tabs-add-btn').first()
    await addBtn.waitFor()
    const geometry = await page.evaluate(() => {
      const center = el => {
        const r = el.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      }
      const tab = document.querySelector('.tabs .tab')
      const add = document.querySelector('.tabs-inner .tabs-add-btn').getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(tab.querySelector('span.tab-title > span:last-child'))
      const title = range.getBoundingClientRect()
      return {
        blank: { x: add.right + 40, y: add.y + add.height / 2 },
        titleRight: title.right,
        tab: center(tab),
        add: center(document.querySelector('.tabs-inner .tabs-add-btn')),
        maximize: { x: window.innerWidth - 70, y: 20 },
        dpr: window.devicePixelRatio
      }
    })
    // The clipped part of the title text reaches the empty point being tested
    expect(geometry.titleRight).toBeGreaterThan(geometry.blank.x)

    const handle = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString()
    )
    const hitTest = async point => {
      const { stdout } = await promisify(execFile)('powershell.exe', [
        '-NoProfile', '-File', resolve(__dirname, 'common/window-hit-test.ps1'),
        '-WindowHandle', handle,
        '-X', String(Math.round(point.x * geometry.dpr)),
        '-Y', String(Math.round(point.y * geometry.dpr))
      ], { windowsHide: true })
      return Number(stdout.trim())
    }

    await expect.poll(() => hitTest(geometry.blank), {
      message: 'Empty titlebar space past a long tab title must drag the window'
    }).toBe(HTCAPTION)
    expect(await hitTest(geometry.tab)).toBe(HTCLIENT)
    expect(await hitTest(geometry.add)).toBe(HTCLIENT)
    expect(await hitTest(geometry.maximize)).toBe(HTMAXBUTTON)
  } finally {
    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})

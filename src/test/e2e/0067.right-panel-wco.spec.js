/**
 * Windows draws its native min/max/close over the top-right corner of the
 * window (the window controls overlay — .wco on the root, see tabs.styl), and
 * the pinned right panel is a dock that starts at the window's top edge. So the
 * panel's title row sat exactly under those buttons: the title was covered, and
 * the pin/close controls could not be clicked at all, because the OS takes
 * every click in that strip. The panel has to reserve it instead.
 *
 * The platform flag behind .wco is a module constant (common/platform.js), so
 * this spec puts the class on the root itself — the same class main.jsx adds on
 * Windows — and asserts what the layout does with it.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const appOptions = require('./common/app-options')

test.setTimeout(60000)

// the caption buttons' strip, as the CSS reserves it (titleBarOverlayHeight in
// app/lib/title-bar.js)
const STRIP = 36

test('pinned right panel clears the Windows caption buttons', async () => {
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-panel-wco-'))
  const app = await electron.launch({
    ...appOptions,
    args: [...appOptions.args, `--user-data-dir=${profileRoot}`],
    env: {
      ...appOptions.env,
      DATA_PATH: path.join(profileRoot, 'data'),
      XDG_CONFIG_HOME: path.join(profileRoot, 'config')
    }
  })
  try {
    let page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    const windows = app.windows()
    page = windows[windows.length - 1] || page
    await page.waitForFunction(() => window.store?.configLoaded === true, null, {
      timeout: 30000
    })

    const probe = () => page.evaluate(() => {
      const rect = sel => {
        const el = document.querySelector(sel)
        if (!el) {
          return null
        }
        const r = el.getBoundingClientRect()
        return {
          left: Math.round(r.left),
          top: Math.round(r.top),
          right: Math.round(r.right),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height)
        }
      }
      const panel = document.querySelector('.right-side-panel')
      const tabs = document.querySelector('.tabs')
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        panel: rect('.right-side-panel'),
        title: rect('.right-panel-title'),
        pin: rect('.right-side-panel-pin'),
        close: rect('.right-side-panel-close'),
        content: rect('.right-side-panel-content'),
        handle: document.querySelectorAll('.right-side-panel .drag-handle').length,
        // the band the panel paints behind the caption buttons has to match the
        // tab bar beside it, or the strip shows as a notch in the panel header
        band: panel ? window.getComputedStyle(panel, '::before').backgroundColor : null,
        tabBar: tabs ? window.getComputedStyle(tabs).backgroundColor : null
      }
    })

    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForFunction(() => window.store.width === 1200)
    await page.evaluate(() => {
      Object.assign(window.store, {
        rightPanelTab: 'info',
        rightPanelVisible: true
      })
    })
    await page.waitForSelector('.right-side-panel .right-panel-title')

    // unpinned: the overlay already starts below the strip, so nothing changes
    const unpinned = await probe()
    assert.equal(unpinned.panel.top, STRIP)
    assert.equal(unpinned.title.top, STRIP)
    assert.equal(unpinned.content.top, STRIP + 55)

    await page.evaluate(() => window.store.setRightPanelPinned(true))
    await page.waitForFunction(() => document.querySelector('.right-side-panel-pinned') !== null)

    // pinned without the overlay class: a full-height dock that starts at the
    // window's top edge — the geometry that put the header under the buttons
    const pinned = await probe()
    assert.equal(pinned.panel.top, 0)
    assert.equal(pinned.panel.bottom, pinned.viewport.height)
    assert.equal(pinned.handle, 1)
    assert.equal(pinned.title.top, 0)
    assert.equal(pinned.content.top, 55)
    assert.equal(pinned.band, 'rgba(0, 0, 0, 0)')

    // ...now with it, the way Windows has it: the strip is reserved, so the
    // title and both controls are out of it. This is the bug — they used to sit
    // at y 19..35, inside the 0..36 strip, where the OS takes the clicks.
    await page.evaluate(() => document.querySelector('.is-desktop').classList.add('wco'))
    await page.waitForTimeout(300)
    const wco = await probe()
    assert.equal(wco.panel.top, 0)
    assert.equal(wco.panel.bottom, wco.viewport.height)
    assert.equal(wco.title.top, STRIP)
    for (const el of ['pin', 'close']) {
      assert.ok(wco[el].top >= STRIP, `${el} must be below the caption strip`)
      assert.ok(wco[el].bottom > STRIP, `${el} must be visible`)
    }
    // the content follows the title row down instead of running behind it
    assert.equal(wco.content.top, STRIP + 55)
    assert.equal(wco.content.top, wco.title.bottom)
    assert.equal(wco.content.bottom, wco.viewport.height)
    // the band is the tab bar's colour, so the strip reads as one title bar
    assert.equal(wco.band, wco.tabBar)
  } finally {
    await app.close()
  }
})

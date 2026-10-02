/**
 * mouseEventsRequireAlt (#4559): with an app requesting mouse reports (tmux
 * `set -g mouse on`, vim, less), a plain drag must stay a local selection that
 * survives mouseup, the wheel must still reach the app, and Option+click must
 * still reach the app.
 *
 * No SSH fixture needed: the app-under-test is put into mouse mode by writing
 * the same DECSET sequences tmux sends (`ESC[?1000h` = VT200 reporting,
 * `ESC[?1006h` = SGR encoding), and "did the app see it" is read off
 * `term.onData`, the single funnel for every byte heading to the pty.
 *
 * Traps this spec deliberately works around:
 *  - `TMPDIR` must point at an existing dir, otherwise Electron falls back to
 *    the shared OS temp dir, finds the running instance's lock socket and quits
 *    ("Target page, context or browser has been closed").
 *  - `work/app/package.json` version must equal the root one or the window
 *    boots the previous bundle and the new option is never set.
 *  - On macOS Playwright's `modifiers: 1` does NOT set `altKey`; hold the real
 *    key with `keyboard.down('Alt')` instead.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const appOptions = require('./common/app-options')
const delay = require('./common/wait')

const ROOT = path.resolve(__dirname, '../../..')

// `ESC[<b;x;yM/m` is the SGR mouse report. Button code 64 == wheel.
// eslint-disable-next-line no-control-regex
const sgr = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/

test.setTimeout(180000)

test('mouseEventsRequireAlt keeps drag-selection while forwarding wheel and option clicks', async () => {
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mea-4559-'))
  const tmpDir = path.join(profileRoot, 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })

  const app = await electron.launch({
    ...appOptions,
    executablePath: path.join(ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
    env: {
      ...appOptions.env,
      DATA_PATH: path.join(profileRoot, 'data'),
      XDG_CONFIG_HOME: path.join(profileRoot, 'config'),
      TMPDIR: tmpDir
    }
  })

  try {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForFunction(
      () => window.store && window.refs && window.refs.size > 0,
      null, { timeout: 60000 }
    )

    const tabId = await page.evaluate(() => window.store.getTabs()[0].id)
    await page.waitForFunction(
      id => {
        const t = window.refs.get('term-' + id)
        return !!(t && t.term)
      },
      tabId, { timeout: 60000 }
    )

    // term.onData is where every byte bound for the pty shows up: keystrokes
    // and forwarded mouse reports alike.
    await page.evaluate(() => {
      const t = window.refs.get('term-' + window.store.getTabs()[0].id)
      window.__term = t.term
      window.__sent = []
      window.__term.onData(d => window.__sent.push(String(d)))
    })

    const geom = await page.evaluate(() => {
      const r = document.querySelector('.session-current .xterm-screen').getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height, cols: window.__term.cols, rows: window.__term.rows }
    })
    const colX = c => geom.x + (c - 0.5) * (geom.w / geom.cols)
    const rowY = r => geom.y + (r - 0.5) * (geom.h / geom.rows)

    const drag = async (row, fromCol, toCol, { alt = false } = {}) => {
      if (alt) await page.keyboard.down('Alt')
      await page.mouse.move(colX(fromCol), rowY(row))
      await page.mouse.down({ button: 'left' })
      for (let c = fromCol + 1; c <= toCol; c++) {
        await page.mouse.move(colX(c), rowY(row), { buttons: 1 })
      }
      await page.mouse.up({ button: 'left' })
      if (alt) await page.keyboard.up('Alt')
      await delay(250)
    }

    // Known text so a selection is assertable.
    await page.evaluate(() => {
      window.__term.write('\x1b[2J\x1b[H')
      window.__term.write('MEA-ALPHA-LINE-1\r\n')
      window.__term.write('MEA-BRAVO-LINE-2\r\n')
      window.__term.write('MEA-CHARLIE-LINE-3\r\n')
    })
    await delay(400)

    // --- baseline: setting off + mouse mode on reproduces the report ---
    await page.evaluate(() => {
      window.store.setConfig({ mouseEventsRequireAlt: false })
      window.__term.clearSelection()
      window.__sent.length = 0
      window.__term.write('\x1b[?1000h\x1b[?1006h')
    })
    await delay(500)

    await drag(2, 1, 22)
    const base = await page.evaluate(() => ({
      sel: window.__term.getSelection(),
      sent: window.__sent.length
    }))
    assert.equal(base.sel, '', 'with the setting off, drag must not select locally')
    assert.ok(base.sent > 0, 'with the setting off, drag must go to the app')

    // --- the fix ---
    await page.evaluate(() => {
      window.store.setConfig({ mouseEventsRequireAlt: true })
      window.__term.clearSelection()
      window.__sent.length = 0
    })
    // setConfig -> re-render -> checkConfigChange pushes into term.options, so
    // no reconnect is needed.
    await page.waitForFunction(
      () => window.__term.options.mouseEventsRequireAlt === true,
      null, { timeout: 10000 }
    )

    await drag(2, 1, 22)
    const on = await page.evaluate(() => ({
      sel: window.__term.getSelection(),
      has: window.__term.hasSelection(),
      sent: window.__sent.length
    }))
    assert.ok(on.has, 'selection must survive mouseup')
    assert.ok(on.sel.includes('MEA-BRAVO-LINE-2'), `unexpected selection ${JSON.stringify(on.sel)}`)
    assert.equal(on.sent, 0, 'a plain drag must not reach the app')

    // wheel still pages the app
    await page.evaluate(() => { window.__sent.length = 0 })
    await page.mouse.move(colX(5), rowY(3))
    await page.mouse.wheel(0, -240)
    await delay(400)
    const wheel = await page.evaluate(() => window.__sent.join(''))
    const wheelMatch = sgr.exec(wheel)
    assert.ok(wheelMatch, `wheel must still be forwarded, got ${JSON.stringify(wheel)}`)
    assert.equal(Number(wheelMatch[1]) & 64, 64, 'wheel report must carry the wheel button bit')

    // Option+click still reaches the app
    await page.evaluate(() => { window.__sent.length = 0 })
    await page.keyboard.down('Alt')
    await page.mouse.move(colX(8), rowY(4))
    await page.mouse.down({ button: 'left' })
    await page.mouse.up({ button: 'left' })
    await page.keyboard.up('Alt')
    await delay(400)
    const altClick = await page.evaluate(() => window.__sent.join(''))
    assert.ok(sgr.test(altClick), `Option+click must be forwarded, got ${JSON.stringify(altClick)}`)

    // Option+drag must not leave a local selection
    await page.evaluate(() => { window.__term.clearSelection(); window.__sent.length = 0 })
    await drag(6, 1, 20, { alt: true })
    const altDrag = await page.evaluate(() => ({
      sel: window.__term.getSelection(),
      sent: window.__sent.length
    }))
    assert.equal(altDrag.sel, '', 'Option+drag must not select locally')
    assert.ok(altDrag.sent > 0, 'Option+drag must reach the app instead')

    // --- mouse mode off: the option must be inert, no behaviour change ---
    await page.evaluate(() => {
      window.__term.write('\x1b[?1000l\x1b[?1006l')
      window.__term.clearSelection()
      window.__sent.length = 0
    })
    await delay(500)
    await drag(3, 1, 22)
    const off = await page.evaluate(() => ({
      sel: window.__term.getSelection(),
      sent: window.__sent.length
    }))
    assert.ok(off.sel.includes('MEA-CHARLIE-LINE-3'), 'drag must select locally as before')
    assert.equal(off.sent, 0, 'nothing may be forwarded')
  } finally {
    await app.close().catch(() => {})
    fs.rmSync(profileRoot, { recursive: true, force: true })
  }
})

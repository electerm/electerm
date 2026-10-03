/**
 * The touch shortcut bar: press-and-hold auto-repeat.
 *
 * The bar used to send a key from `click` alone, so holding a button sent it
 * once and stopped — you had to tap ↓ / Bksp over and over. This spec drives
 * real pointer events against the running app and counts what the terminal
 * actually received, so the whole chain is covered: DOM event → gesture
 * bookkeeping → runQuickCommand → the socket.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
require('./common/env')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const delay = require('./common/wait')
const { setupSshConnection } = require('./common/common')
const {
  ensureKnownHostsEntry,
  startTestSshServer,
  stopTestSshServer,
  TEST_PORT
} = require('../integration/lib/ssh-test-server')

test.setTimeout(180000)

const BAR = '.shortcut-bar'
const BTN = '.shortcut-bar-btn'

// long-press threshold + repeat interval live in shortcut-bar-press.js; stay
// in the same ballpark so the test does not depend on their exact values
const HOLD = 400
const REPEAT = 60

// Records every runQuickCommand payload the active terminal receives, so the
// assertions can talk about keys sent rather than pixels painted.
const installSpy = page => page.evaluate(() => {
  window.__sent = []
  window.__install = () => {
    const term = window.refs.get('term-' + window.store.activeTabId)
    if (!term) {
      return false
    }
    if (term.__spied) {
      return true
    }
    term.__spied = true
    const orig = term.runQuickCommand.bind(term)
    term.runQuickCommand = (cmd, inputOnly) => {
      window.__sent.push(cmd)
      return orig(cmd, inputOnly)
    }
    return true
  }
  return true
})

/**
 * press → (optional slide) → hold → release on one button.
 *
 * `slidePx` turns the press into a drag, which is how the bar is scrolled.
 *
 * The trailing `btn.click()` is not redundant: a dispatched PointerEvent does
 * not make the browser synthesize the click a real tap produces (only
 * pointerdown/pointerup fire), and no click is synthesized when the press slid
 * off the button either. Without it the tap path is never exercised, and a
 * hold is measured without the trailing click it has to swallow.
 */
const gesture = (page, label, holdMs, slidePx) => page.evaluate(
  async ([sel, label, holdMs, slidePx]) => {
    const btn = Array.from(document.querySelectorAll(sel))
      .find(el => el.innerText.trim() === label)
    if (!btn) {
      throw new Error(`no shortcut button labelled ${label}`)
    }
    const r = btn.getBoundingClientRect()
    const x0 = r.left + r.width / 2
    const y0 = r.top + r.height / 2
    const at = (type, x, y) => btn.dispatchEvent(new window.PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1
    }))
    at('pointerdown', x0, y0)
    if (slidePx) {
      await new Promise(resolve => setTimeout(resolve, holdMs / 3))
      at('pointermove', x0 + slidePx, y0 + 30)
    }
    await new Promise(resolve => setTimeout(resolve, holdMs))
    at('pointerup', x0 + (slidePx || 0), y0 + (slidePx ? 30 : 0))
    if (!slidePx) {
      btn.click()
    }
  },
  [BTN, label, holdMs, slidePx]
)

const sentKeys = page => page.evaluate(() => window.__sent.slice())

const clearSent = page => page.evaluate(() => {
  window.__sent = []
})

let sshServer
let fixtureRoot
let profileRoot

test.beforeAll(async () => {
  ensureKnownHostsEntry(TEST_PORT)
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-sc-hold-'))
  profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-sc-hold-profile-'))
  sshServer = await startTestSshServer({ port: TEST_PORT, rootDir: fixtureRoot })
})

test.afterAll(async () => {
  if (sshServer) {
    await stopTestSshServer(sshServer)
  }
  if (fixtureRoot) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
  }
  if (profileRoot) {
    fs.rmSync(profileRoot, { recursive: true, force: true })
  }
})

test('shortcut bar repeats a key while it is held', async () => {
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
    await delay(1200)
    const windows = app.windows()
    page = windows[windows.length - 1] || page
    extendClient(page, app)
    await page.waitForFunction(() => window.store?.configLoaded === true, null, {
      timeout: 30000
    })
    await page.setViewportSize({ width: 1200, height: 800 })

    // a terminal session, so the bar has somewhere to send keys
    await setupSshConnection(page, { waitAfterConnect: 1500 })
    await page.waitForFunction(() => window.store.currentTab?.status === 'success', null, {
      timeout: 30000
    })

    // Mount the bar the way shortcut-bar-entry.jsx does.
    //
    // The entry renders nothing until it has SEEN a soft keyboard shrink the
    // visual viewport; a desktop run never produces that, and setting
    // store.shortcutBarVisible is not enough because the component is never
    // reached. So replay the signal it listens for: a touch (it timestamps
    // every touch/pen pointerdown) then a drop in BOTH viewports, which is
    // the Android-keyboard branch of its detection.
    await page.evaluate(() => {
      window.store.isTouchDevice = true
      document.body.dispatchEvent(new window.PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'touch',
        isPrimary: true
      }))
    })
    const vp = page.viewportSize()
    await page.setViewportSize({ width: vp.width, height: vp.height - 200 })
    await delay(400)
    await page.setViewportSize(vp)
    await delay(400)
    await page.evaluate(() => {
      window.store.shortcutBarVisible = true
    })
    await page.waitForSelector(BAR, { timeout: 15000 })
    await installSpy(page)
    assert.equal(await page.evaluate(() => window.__install()), true)

    // ---- a tap is still exactly one key
    await clearSent(page)
    await gesture(page, 'Esc', 40)
    await delay(250)
    assert.deepEqual(
      await sentKeys(page),
      ['\x1b'],
      'a tap must send its key once'
    )

    // ---- holding repeats: this is the behaviour that was missing
    await clearSent(page)
    await gesture(page, '↓', HOLD + REPEAT * 5)
    await delay(250)
    const held = await sentKeys(page)
    assert.ok(
      held.length >= 4,
      `holding ↓ must repeat it, got ${held.length} send(s)`
    )
    assert.deepEqual(
      [...new Set(held)],
      ['\x1b[B'],
      'every repeat must be the same key'
    )
    // the click the browser fires on release must NOT add one more, or a hold
    // overshoots by exactly one — which makes a held Ctrl+C land a command too
    // many
    assert.ok(
      held.length <= 8,
      `a hold must not overshoot, got ${held.length} send(s)`
    )

    // ---- a press that slides off is a scroll, not a burst of keys
    await clearSent(page)
    await gesture(page, '↓', HOLD, 120)
    await delay(250)
    assert.deepEqual(
      await sentKeys(page),
      [],
      'a press that turns into a scroll must send nothing'
    )

    // ---- releasing stops it for good
    await clearSent(page)
    await gesture(page, 'Esc', HOLD + REPEAT * 2)
    await delay(150)
    const atRelease = (await sentKeys(page)).length
    // >=2: the threshold send plus at least one tick. The exact count depends
    // on timer jitter; the property under test is that it stops.
    assert.ok(atRelease >= 2, `only ${atRelease} send(s) before release`)
    await delay(1400)
    assert.equal(
      (await sentKeys(page)).length,
      atRelease,
      'the repeat must stop for good once the finger lifts'
    )

    // ---- hiding the bar mid-hold leaves nothing running
    await clearSent(page)
    await page.evaluate(async ([sel, wait]) => {
      const btn = Array.from(document.querySelectorAll(sel))
        .find(el => el.innerText.trim() === '↓')
      const r = btn.getBoundingClientRect()
      btn.dispatchEvent(new window.PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 11,
        pointerType: 'touch',
        isPrimary: true,
        clientX: r.left + 5,
        clientY: r.top + 5,
        button: 0,
        buttons: 1
      }))
      await new Promise(resolve => setTimeout(resolve, wait))
      window.store.shortcutBarVisible = false
    }, [BTN, HOLD])
    await delay(1400)
    const atHide = (await sentKeys(page)).length
    await delay(600)
    assert.equal(
      (await sentKeys(page)).length,
      atHide,
      'hiding the bar mid-hold must kill the repeat'
    )

    // ---- focus must not move to a bar button, whenever it happens
    //
    // The soft keyboard belongs to the xterm helper textarea. A focusable button
    // takes focus on a real press, and Android Chrome then dismisses the input
    // panel — which drops the bar (it rides above the panel) and visibly breaks
    // the hold. Reported on Android as: closes once, pops straight back, then
    // never again, because the repeat's own runQuickCommand -> term.focus() was
    // pulling focus straight back and the theft never got a second chance.
    //
    // Two things are asserted, and both matter:
    //   - a theft that lands long after pointerdown never sticks. Timing a
    //     reclaim per-event cannot do this: Chromium synthesizes the
    //     compatibility mouse events only AFTER touchend, so on touch the
    //     button takes focus after any pointerdown-time reclaim already ran.
    //     The reclaim is driven from focusin, which is timing independent.
    //   - the reclaim does not loop (focus() re-raises focusin).
    //   - focus outside the bar is left alone, so the edit modal's inputs and
    //     the terminal's own focus keep working.
    //
    // Playwright's real input is required: a synthetic event runs no default
    // action, so it can never catch this at all.
    await page.evaluate(() => {
      window.__focusinCount = 0
      window.addEventListener('focusin', () => { window.__focusinCount++ }, true)
    })
    const lateTheft = await page.evaluate(() => {
      const focusTerm = () => window.refs
        .get('term-' + window.store.activeTabId).term.focus()
      const active = () => {
        const el = document.activeElement
        return el ? el.tagName.toLowerCase() : '(none)'
      }
      const bar = Array.from(document.querySelectorAll('.shortcut-bar-btn'))
        .find(el => el.innerText.trim() === '↓')
      focusTerm()
      const before = active()
      // exactly what the compatibility mousedown ends up doing
      bar.focus()
      return { before, after: active() }
    })
    assert.ok(
      lateTheft.before.startsWith('textarea') && lateTheft.after.startsWith('textarea'),
      `focus stolen after pointerdown must not stick, got ${JSON.stringify(lateTheft)}`
    )

    const loopCount = await page.evaluate(async () => {
      window.__focusinCount = 0
      const btn = Array.from(document.querySelectorAll('.shortcut-bar-btn'))
        .find(el => el.innerText.trim() === '↓')
      for (let i = 0; i < 5; i++) {
        btn.focus()
        await new Promise(resolve => setTimeout(resolve, 30))
      }
      return window.__focusinCount
    })
    // 5 steals + at most one reclaim each; a loop would be unbounded
    assert.ok(loopCount <= 12, `reclaim must not loop, saw ${loopCount} focusin`)

    const outsideKept = await page.evaluate(() => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()
      const got = document.activeElement === input
      input.remove()
      return got
    })
    assert.ok(outsideKept, 'focus outside the bar must be left alone')

    // ---- repeated real holds: focus never leaves
    const boxOnScreen = (sel, label) => page.evaluate(([s, l]) => {
      const btn = Array.from(document.querySelectorAll(s))
        .find(el => el.innerText.trim() === l)
      // the bar is a horizontal scroller and the default button set overflows
      // a 1200px viewport, so a later button can sit off-screen and a real
      // mouse would hit nothing
      btn.scrollIntoView({ block: 'nearest', inline: 'center' })
      const r = btn.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }, [sel, label])

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.__sent = []
        window.refs.get('term-' + window.store.activeTabId).term.focus()
      })
      const b = await boxOnScreen(BTN, '↓')
      await page.mouse.move(b.x, b.y)
      await page.mouse.down()
      // past the hold threshold, so the repeat has actually fired
      await delay(HOLD + 100)
      const held = await page.evaluate(() => {
        const el = document.activeElement
        return el ? el.tagName.toLowerCase() : '(none)'
      })
      await page.mouse.up()
      await delay(200)
      assert.ok(
        held.startsWith('textarea'),
        `hold #${i + 1} must not move focus off the terminal, got ${held}`
      )
      assert.ok(
        (await sentKeys(page)).length >= 1,
        `hold #${i + 1} must still repeat its key`
      )
    }

    // ---- a tap still delivers exactly one key with focus held
    await page.evaluate(() => {
      window.__sent = []
      window.refs.get('term-' + window.store.activeTabId).term.focus()
    })
    const eb = await boxOnScreen(BTN, 'Esc')
    await page.mouse.move(eb.x, eb.y)
    await page.mouse.down()
    await delay(60)
    await page.mouse.up()
    await delay(250)
    assert.deepEqual(
      await sentKeys(page),
      ['\x1b'],
      'a tap must send its key once'
    )

    // ---- the icon buttons are focusable too and share the same hazard
    await page.evaluate(() => {
      window.refs.get('term-' + window.store.activeTabId).term.focus()
    })
    const ib = await page.evaluate(() => {
      const r = document.querySelector('.shortcut-bar-icon-btn')
        .getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    await page.mouse.move(ib.x, ib.y)
    await page.mouse.down()
    await delay(150)
    const iconHeld = await page.evaluate(() => {
      const el = document.activeElement
      return el ? el.tagName.toLowerCase() : '(none)'
    })
    await page.mouse.up()
    assert.ok(
      iconHeld.startsWith('textarea'),
      `an icon button press must not steal focus, got ${iconHeld}`
    )

    // ---- a swipe must not arm anything: the next tap still sends its key
    await page.evaluate(() => {
      window.store.shortcutBarVisible = true
    })
    await page.waitForSelector(BAR)
    await clearSent(page)
    await gesture(page, '↓', HOLD, 120)
    await delay(250)
    await gesture(page, 'Esc', 40)
    await delay(250)
    assert.deepEqual(
      await sentKeys(page),
      ['\x1b'],
      'a tap after a slide-off must not be swallowed'
    )
  } finally {
    await app.close()
  }
})

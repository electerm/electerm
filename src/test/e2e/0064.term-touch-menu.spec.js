/**
 * The touch-only terminal context menu icon: shown next to the fullscreen icon
 * on the desktop toolbar and next to the three-dot toggle on mobile, and it
 * opens the same menu a right click / long press does.
 *
 * Touch input itself is not driven here: the icon is only rendered while
 * `store.isTouchDevice` is true, and a real mouse click would flip that back
 * (see main.jsx), so the tap is simulated as a touch pointerdown plus a click,
 * the same way 0061.remote-monitor-bar.spec.js pokes the flag.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
require('./common/env')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { setupSshConnection } = require('./common/common')

test.setTimeout(180000)

const MENU_ITEM = '.ant-dropdown-menu-item'
// only the active tab's session: an inactive one keeps its own control bar
// mounted, just hidden
const CURRENT_ICON = '.session-current .context-menu-control-icon'
const DESKTOP_ICON = '.session-current .term-controls .context-menu-control-icon'
const MOBILE_ICON = '.session-current .mobile-session-control .context-menu-control-icon'

const tapIcon = (page, sel) => page.evaluate((selector) => {
  const el = document.querySelector(selector)
  if (!el) {
    throw new Error(`no ${selector} to tap`)
  }
  el.dispatchEvent(new window.PointerEvent('pointerdown', {
    bubbles: true,
    pointerType: 'touch'
  }))
  el.click()
}, sel)

// the label is the first line: menu items carry their shortcut underneath
const menuItems = (page) => page.evaluate((sel) => Array.from(
  document.querySelectorAll(`.ant-dropdown-menu ${sel}`)
).map(el => el.innerText.trim().split('\n')[0].trim().toLowerCase()), MENU_ITEM)

// the menu is translated, so ask the app itself what a label reads as
const label = (page, key) => page.evaluate(
  (k) => String(window.translate(k)).trim().toLowerCase(),
  key
)

// antd hides on a window mousedown outside the popup — the same listener a
// real click on the terminal would hit
const closeMenu = async (page) => {
  const open = await page.evaluate((sel) => {
    const el = document.querySelector(`.ant-dropdown-menu ${sel}`)
    return !!el?.offsetParent
  }, MENU_ITEM)
  if (!open) {
    return
  }
  await page.evaluate(() => {
    document.body.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
  })
  await page.waitForFunction((sel) => {
    const el = document.querySelector(`.ant-dropdown-menu ${sel}`)
    return !el?.offsetParent
  }, MENU_ITEM)
}

test('touch terminal menu icon opens the terminal context menu', async () => {
  const profileRoot = path.join(
    process.cwd(),
    'temp',
    `e2e-touch-menu-${Date.now()}`
  )
  fs.mkdirSync(profileRoot, { recursive: true })
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
    extendClient(page, app)
    await page.waitForFunction(() => window.store?.configLoaded === true, null, {
      timeout: 30000
    })
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForFunction(() => window.store.width === 1200)

    // a terminal session is what the menu belongs to
    await setupSshConnection(page, { waitAfterConnect: 1500 })
    await page.waitForFunction(() => window.store.currentTab?.status === 'success')
    await page.waitForSelector('.session-current .fullscreen-control-icon')

    // ---- desktop toolbar: hidden for a mouse, next to fullscreen for touch
    assert.equal(await page.locator(CURRENT_ICON).count(), 0)

    await page.evaluate(() => {
      window.store.isTouchDevice = true
    })
    await page.waitForSelector(DESKTOP_ICON)
    assert.deepEqual(
      await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        return {
          next: el.nextElementSibling?.className.includes('fullscreen-control-icon'),
          parent: el.parentElement.className.includes('term-controls')
        }
      }, DESKTOP_ICON),
      { next: true, parent: true }
    )

    await tapIcon(page, DESKTOP_ICON)
    await page.waitForSelector(MENU_ITEM, { state: 'visible' })
    const desktopItems = await menuItems(page)
    // touch mode is on, so the menu offers the overlay where the OS does the
    // selecting — proof this is the terminal menu, not some other dropdown
    const selectText = await label(page, 'selectText')
    const paste = await label(page, 'paste')
    assert.ok(desktopItems.includes(selectText), desktopItems.join(','))
    assert.ok(desktopItems.includes(paste), desktopItems.join(','))

    // ---- mobile toolbar: next to the three-dot toggle, outside the popover
    await closeMenu(page)
    await page.setViewportSize({ width: 375, height: 800 })
    await page.waitForFunction(() => window.store.isMobile === true)
    await page.waitForSelector(MOBILE_ICON)
    assert.deepEqual(
      await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        return {
          next: el.nextElementSibling?.className.includes('mobile-control-toggle'),
          inPopover: !!el.closest('.mobile-control-icons')
        }
      }, MOBILE_ICON),
      { next: true, inPopover: false }
    )

    await tapIcon(page, MOBILE_ICON)
    await page.waitForFunction((txt) => Array.from(
      document.querySelectorAll('.ant-dropdown-menu .ant-dropdown-menu-item')
    ).some(el => el.innerText.trim().split('\n')[0].trim().toLowerCase() === txt), selectText)

    // ---- gates: not a touch input, and no menu to open at all
    await page.evaluate(() => {
      window.store.isTouchDevice = false
    })
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length === 0,
      CURRENT_ICON
    )
    await page.evaluate(() => {
      window.store.isTouchDevice = true
      window.store.setConfig({ pasteWhenContextMenu: true })
    })
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length === 0,
      CURRENT_ICON
    )
    await page.evaluate(() => {
      window.store.setConfig({ pasteWhenContextMenu: false })
    })
    await page.waitForSelector(MOBILE_ICON)
  } finally {
    await app.close()
    fs.rmSync(profileRoot, { recursive: true, force: true })
  }
})

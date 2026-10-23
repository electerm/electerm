/**
 * The system menu (logo popover, top left) must dismiss itself once an entry
 * has run. It used to stay open forever: the popover was uncontrolled, the
 * `onClick` on the trigger pointed at a method that did not exist, and nothing
 * closed it after an action, so the open popover swallowed the next click.
 *
 * No SSH host needed — every entry checked here is local.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const delay = require('./common/wait')
const e = require('./common/lang')

test.setTimeout(120000)

const MENU = '.context-menu-inner'
const TRIGGER = '.menu-control'

test('system menu dismisses itself after an entry runs', async () => {
  const app = await electron.launch(appOptions)
  try {
    const page = await app.firstWindow()
    extendClient(page, app)
    await delay(4000)
    const menu = page.locator(MENU).first()
    const trigger = page.locator(TRIGGER).first()

    // the trigger toggles the popover both ways
    await trigger.click()
    await menu.waitFor({ state: 'visible', timeout: 10000 })
    await trigger.click()
    await menu.waitFor({ state: 'hidden', timeout: 10000 })

    // a plain entry: run the action and dismiss
    await trigger.click()
    await menu.waitFor({ state: 'visible', timeout: 10000 })
    await page
      .locator(`.context-item:not(.with-sub-menu):has-text("${e('settings')}")`)
      .first()
      .click()
    await menu.waitFor({ state: 'hidden', timeout: 10000 })
    assert.equal(
      await page.locator('.setting-wrap').isVisible(),
      true,
      'settings panel opened'
    )
    // the settings panel is full screen; close it before touching the menu
    await page.locator('.setting-wrap .ant-btn:has-text("' + e('close') + '")')
      .first()
      .click()
      .catch(() => {})
    await page.keyboard.press('Escape').catch(() => {})
    await delay(1000)

    // a submenu entry: the submenu lives inside its parent item, so a click on
    // a leaf has to dismiss the whole popover as well
    await trigger.click()
    await menu.waitFor({ state: 'visible', timeout: 10000 })
    const layoutItem = page
      .locator(`.context-item.with-sub-menu:has-text("${e('layout')}")`)
      .first()
    await layoutItem.hover()
    // scope to this item's own submenu: the hidden ones of the other
    // submenu items are in the DOM too and would match first
    const leaf = layoutItem.locator('.sub-context-menu-item').first()
    await leaf.waitFor({ state: 'visible', timeout: 10000 })
    await leaf.click()
    await menu.waitFor({ state: 'hidden', timeout: 10000 })
  } finally {
    await app.close().catch(() => {})
  }
})

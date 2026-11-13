/**
 * Bookmark watchers: the SSH bookmark form section, and what a session started
 * from that bookmark shows in the monitor bar / info panel.
 *
 * Uses the same in-process SSH fixture as 0061/0062.
 */

const { _electron: electron, test } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const delay = require('./common/wait')
const {
  ensureKnownHostsEntry,
  startTestSshServer,
  stopTestSshServer,
  TEST_PASSWORD,
  TEST_PORT,
  TEST_USERNAME
} = require('../integration/lib/ssh-test-server')

let sshServer
let fixtureRoot
let profileRoot

test.setTimeout(180000)

test.beforeAll(async () => {
  ensureKnownHostsEntry(TEST_PORT)
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-watcher-fixture-'))
  profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-watcher-profile-'))
  sshServer = await startTestSshServer({
    port: TEST_PORT,
    rootDir: fixtureRoot
  })
})

test.afterAll(async () => {
  if (sshServer) {
    await stopTestSshServer(sshServer)
  }
  for (const dir of [fixtureRoot, profileRoot]) {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
})

async function launchApp () {
  const app = await electron.launch({
    ...appOptions,
    args: [...appOptions.args, `--user-data-dir=${profileRoot}`],
    env: {
      ...appOptions.env,
      DATA_PATH: path.join(profileRoot, 'data'),
      XDG_CONFIG_HOME: path.join(profileRoot, 'config')
    }
  })
  let page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await delay(1000)
  const windows = app.windows()
  page = windows[windows.length - 1] || page
  extendClient(page, app)
  await page.waitForFunction(() => window.store?.configLoaded === true, null, {
    timeout: 30000
  })
  return { app, page }
}

async function addWatcher (page, { name, command, interval }) {
  await page.click('.watcher-editor-toolbar button')
  await page.waitForSelector('#watcher-form-command', { state: 'visible' })
  if (name) {
    await page.fill('#watcher-form-name', name)
  }
  await page.fill('#watcher-form-command', command)
  if (interval) {
    await page.fill('#watcher-form-interval', String(interval))
  }
  await page.click('.watcher-form-actions .ant-btn-primary')
  await delay(400)
}

// A toggle in either filter has to reach the bookmark, not just the open tab.
async function savedEnabled (page) {
  return page.evaluate(() => window.store.bookmarks
    .find(item => item.host === '127.0.0.1')
    .watchers.map(watcher => watcher.enabled))
}

// App notifications are fixed to the bottom right, right on top of the monitor
// bar's controls. They are not part of what this spec is testing, so clear them
// before reaching for the funnel.
async function dismissNotifications (page) {
  const close = page.locator('.notification-close')
  const count = await close.count()
  for (let i = 0; i < count; i++) {
    await close.nth(i).click({ force: true })
  }
  await delay(200)
}

test('watchers saved on a bookmark drive the monitor bar and info panel', async () => {
  const { app, page } = await launchApp()
  try {
    await page.evaluate(() => window.store.onNewSsh())
    await page.waitForSelector('#ssh-form_host', { state: 'visible' })
    await page.fill('#ssh-form_host', '127.0.0.1')
    await page.fill('#ssh-form_username', TEST_USERNAME)
    await page.fill('#ssh-form_password', TEST_PASSWORD)
    await page.fill('#ssh-form_port', String(TEST_PORT))

    // the watcher section lives on its own tab, next to triggers
    assert.equal(await page.locator('.setting-wrap .ant-tabs-tab', { hasText: 'Watchers' }).count(), 1)
    await page.click('.setting-wrap .ant-tabs-tab:has-text("Watchers")')
    await delay(300)
    assert.equal(await page.locator('.watcher-editor').count(), 1)
    assert.equal(await page.locator('.watcher-editor .ant-empty').count(), 1)

    await addWatcher(page, {
      name: 'GPU 0',
      command: 'echo "GPU 0: 45C"',
      interval: 1
    })
    assert.equal(await page.locator('.watcher-row').count(), 1)

    // a `watch` wrapper is unwrapped and its interval becomes the refresh rate
    await page.click('.watcher-editor-toolbar button')
    await page.waitForSelector('#watcher-form-command', { state: 'visible' })
    await page.fill('#watcher-form-command', "watch -n 2 'echo tick'")
    await delay(300)
    assert.match(await page.locator('.watcher-form-detected').innerText(), /echo tick/)
    assert.equal(await page.inputValue('#watcher-form-interval'), '2')
    await page.click('.watcher-form-actions .ant-btn-primary')
    await delay(400)
    assert.equal(await page.locator('.watcher-row').count(), 2)

    // save + connect
    await page.click('#ssh-form button[type=submit]')
    await page.waitForFunction(
      () => window.store.tabs.some(tab => tab.host && tab.status === 'success'),
      null,
      { timeout: 40000 }
    )
    await page.evaluate(() => {
      const tab = window.store.tabs.find(item => item.host)
      window.store.activeTabId = tab.id
    })
    await delay(1500)

    const watchers = await page.evaluate(() => window.store.currentTab.watchers)
    assert.equal(watchers.length, 2)
    assert.equal(watchers[1].command, 'echo tick')
    assert.equal(watchers[1].interval, 2)
    const saved = await page.evaluate(() => window.store.bookmarks
      .filter(item => item.host === '127.0.0.1')
      .map(item => (item.watchers || []).length))
    assert.deepEqual(saved, [2])

    // monitor bar: watchers follow the bookmark and are part of the item filter
    await page.evaluate(() => window.store.setConfig({ remoteMonitorBarEnabled: true }))
    await page.waitForSelector(`.remote-monitor-item-${watchers[0].id}`, { state: 'visible', timeout: 20000 })
    await delay(2500)
    const item = await page.locator(`.remote-monitor-item-${watchers[0].id}`).innerText()
    assert.match(item, /GPU 0: 45C/)
    assert.equal(await page.locator('.remote-monitor-item').count(), 11)
    assert.equal(await page.locator('.remote-monitor-filter .item-filter-count').innerText(), '(11/11)')

    // the filter checklist carries the watchers, under their own names.
    // The controls are only revealed while the bar is hovered (or its filter is
    // open), so the pointer has to be on the bar before the funnel is clickable.
    await dismissNotifications(page)
    await page.hover('.remote-monitor-bar')
    await page.click('.remote-monitor-filter')
    const gpuFilterItem = page.locator(`.ant-popover:visible .item-filter-list [data-filter-item="${watchers[0].id}"]`)
    await gpuFilterItem.waitFor({ state: 'visible' })
    assert.match(await gpuFilterItem.innerText(), /GPU 0/)

    // switching one off hides its bar item and is written back to the bookmark
    await gpuFilterItem.click()
    await delay(600)
    assert.equal(await page.locator(`.remote-monitor-item-${watchers[0].id}`).count(), 0)
    assert.equal(await page.locator('.remote-monitor-item').count(), 10)
    assert.equal(await page.locator('.remote-monitor-filter .item-filter-count').innerText(), '(10/11)')
    assert.deepEqual(await savedEnabled(page), [false, true])

    // and switching it back on restores it
    await gpuFilterItem.click()
    await delay(800)
    assert.equal(await page.locator(`.remote-monitor-item-${watchers[0].id}`).count(), 1)
    assert.deepEqual(await savedEnabled(page), [true, true])
    await page.click('.remote-monitor-filter')
    await delay(300)

    await page.click(`.remote-monitor-item-${watchers[0].id}`)
    await delay(600)
    // hovering the bar to reach the funnel can open an item popover; antd keeps
    // closed ones mounted, so only the visible popover counts here
    const output = await page.locator('.remote-monitor-popover:visible .remote-monitor-custom-output').innerText()
    assert.match(output, /GPU 0: 45C/)
    await page.keyboard.press('Escape')
    await delay(300)

    // info panel: same watchers, appended after the built-in sections
    await page.evaluate(() => window.store.openInfoPanel())
    await page.waitForSelector(
      `.right-side-panel-content [data-monitor-detail="${watchers[0].id}"]`,
      { state: 'visible', timeout: 20000 }
    )
    await delay(2000)
    const panel = await page.locator(`.right-side-panel-content [data-monitor-detail="${watchers[0].id}"]`).innerText()
    assert.match(panel, /GPU 0: 45C/)
    assert.equal(
      await page.locator(`.right-side-panel-content [data-monitor-detail="${watchers[1].id}"]`).count(),
      1
    )

    // the panel's own filter lists them as well, and the flag is shared with the
    // bar: switching one off here hides the section too
    await dismissNotifications(page)
    await page.click('.terminal-info-filter-wrap .item-filter')
    const tickFilterItem = page.locator(`.ant-popover:visible .item-filter-list [data-filter-item="${watchers[1].id}"]`)
    await tickFilterItem.waitFor({ state: 'visible' })
    assert.match(await tickFilterItem.innerText(), /echo/)
    await tickFilterItem.click()
    await delay(600)
    assert.equal(
      await page.locator(`.right-side-panel-content [data-monitor-detail="${watchers[1].id}"]`).count(),
      0
    )
    assert.deepEqual(await savedEnabled(page), [true, false])
  } finally {
    await app.close().catch(() => {})
  }
})

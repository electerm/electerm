/**
 * Remote monitor bar with an in-process Linux SSH fixture.
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

// NOTE: do NOT copy the in-process fixture credentials into process.env here.
// Playwright shares one process.env across every spec file in the run, so
// mutating TEST_HOST/TEST_USER/TEST_PASS/TEST_PORT would hijack all later
// SSH/SFTP specs (005/008/009*) to dial 127.0.0.1:22022. This spec passes
// the fixture credentials explicitly via connectFixture() instead.
const { setupSshConnection } = require('./common/common')

const defaultItems = [
  'hostname',
  'cpu',
  'cpuHistory',
  'memory',
  'upload',
  'download',
  'uptime',
  'users',
  'disks'
]

let sshServer
let fixtureRoot
let profileRoot

test.setTimeout(180000)

test.beforeAll(async () => {
  ensureKnownHostsEntry(TEST_PORT)
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-remote-monitor-'))
  profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-remote-monitor-profile-'))
  sshServer = await startTestSshServer({
    port: TEST_PORT,
    rootDir: fixtureRoot
  })
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

async function connectFixture (page) {
  await setupSshConnection(page, {
    host: '127.0.0.1',
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    port: String(TEST_PORT),
    waitAfterConnect: 1000
  })
  await page.waitForFunction(() => window.store.currentTab?.status === 'success')
}

// The bookmark modal triggers the sticky "load ssh configs" prompt
// (duration: 0). It sits in the bottom-right corner and blocks clicks on the
// monitor bar controls, so dismiss it right after the first connection.
async function dismissSshConfigNotify (page) {
  const ignoreBtn = page.locator('.notification button:has-text("Ignore")')
  if (await ignoreBtn.count().catch(() => 0)) {
    await ignoreBtn.first().click().catch(() => {})
  }
  await page
    .locator('.notification:has-text("Ignore")')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {})
}

test('remote monitor bar renders, shares details, configures and persists', async () => {
  let running = await launchApp()
  try {
    await running.page.evaluate(items => {
      window.store.setConfig({
        remoteMonitorBarEnabled: true,
        remoteMonitorBarItems: items
      })
    }, defaultItems)
    // The production chunk (or dev module) must not load for local terminals.
    const monitorModuleLoaded = () => running.page.evaluate(() =>
      performance.getEntriesByType('resource').some(({ name }) =>
        /\/remote-monitor-bar(?:-\d[^/]*\.js|\.jsx)(?:\?|$)/.test(name)
      )
    )
    assert.equal(await monitorModuleLoaded(), false)
    await connectFixture(running.page)
    await dismissSshConfigNotify(running.page)

    const bar = running.page.locator('.remote-monitor-bar')
    await bar.waitFor({ state: 'visible' })
    assert.equal(await monitorModuleLoaded(), true)
    assert.equal(await bar.locator('.remote-monitor-item').count(), 9)
    await bar.locator('.remote-monitor-item-cpuHistory svg').waitFor({ state: 'visible' })
    assert.equal(await bar.locator('.remote-monitor-item-cpuHistory svg').count(), 1)
    const borders = await bar.evaluate(node => {
      const item = node.querySelector('.remote-monitor-item')
      return {
        barTop: window.getComputedStyle(node).borderTopWidth,
        itemRight: window.getComputedStyle(item).borderRightWidth
      }
    })
    assert.deepEqual(borders, { barTop: '0px', itemRight: '0px' })

    const controls = bar.locator('.remote-monitor-controls')
    await running.page.mouse.move(2, 2)
    await running.page.waitForFunction(() => {
      const node = document.querySelector('.remote-monitor-controls')
      return node && window.getComputedStyle(node).opacity === '0'
    })
    await running.page.evaluate(() => {
      window.store.isTouchDevice = true
    })
    await running.page.waitForFunction(() => {
      const node = document.querySelector('.remote-monitor-controls')
      return node && window.getComputedStyle(node).opacity === '1'
    })
    await running.page.evaluate(() => {
      window.store.isTouchDevice = false
    })
    await running.page.waitForFunction(() => {
      const node = document.querySelector('.remote-monitor-controls')
      return node && window.getComputedStyle(node).opacity === '0'
    })
    await bar.hover()
    await running.page.waitForFunction(() => {
      const node = document.querySelector('.remote-monitor-controls')
      return node && window.getComputedStyle(node).opacity === '1'
    })
    await running.page.waitForFunction(() => {
      const cpu = document.querySelector('.remote-monitor-item-cpu')
      return cpu && !cpu.textContent.includes('—')
    })

    const cpuLabel = await bar.locator('.remote-monitor-item-cpu').getAttribute('aria-label')
    assert.match(cpuLabel, /CPU.*\d+%.*(?:Normal|Warning|High usage)/)

    const typeTabs = running.page.locator('.session-current .term-sftp-tabs .type-tab')
    assert.ok(await typeTabs.count() >= 2)
    await typeTabs.nth(1).click()
    await bar.waitFor({ state: 'visible' })
    assert.equal(await bar.locator('.remote-monitor-item').count(), 9)
    await typeTabs.nth(0).click()

    const geometry = await running.page.evaluate(() => {
      const monitor = document.querySelector('.remote-monitor-bar').getBoundingClientRect()
      const footer = document.querySelector('.main-footer').getBoundingClientRect()
      const terminal = document.querySelector('.session-current .term-wrap').getBoundingClientRect()
      return {
        monitorTop: monitor.top,
        monitorBottom: monitor.bottom,
        footerTop: footer.top,
        terminalBottom: terminal.bottom
      }
    })
    assert.ok(Math.abs(geometry.monitorBottom - geometry.footerTop) <= 2)
    assert.ok(geometry.terminalBottom <= geometry.monitorTop + 2)

    await running.page.evaluate(() => window.store.toggleSessFullscreen(true))
    await delay(700)
    const fullscreenGeometry = await running.page.evaluate(() => {
      const monitor = document.querySelector('.remote-monitor-bar').getBoundingClientRect()
      const footer = document.querySelector('.main-footer').getBoundingClientRect()
      const terminal = document.querySelector('.session-current .term-wrap').getBoundingClientRect()
      return {
        monitorLeft: monitor.left,
        monitorTop: monitor.top,
        monitorBottom: monitor.bottom,
        footerTop: footer.top,
        terminalBottom: terminal.bottom
      }
    })
    assert.ok(fullscreenGeometry.monitorLeft <= 2)
    assert.ok(Math.abs(fullscreenGeometry.monitorBottom - fullscreenGeometry.footerTop) <= 2)
    assert.ok(fullscreenGeometry.terminalBottom <= fullscreenGeometry.monitorTop + 2)
    await running.page.evaluate(() => window.store.toggleSessFullscreen(false))
    await delay(700)

    const memoryItem = running.page.locator('.remote-monitor-item-memory')
    await memoryItem.hover()
    const popover = running.page.locator(
      '.remote-monitor-popover[data-monitor-detail="memory"]'
    )
    await popover.waitFor({ state: 'visible' })
    await memoryItem.click()
    await running.page.mouse.move(2, 2)
    await popover.waitFor({ state: 'visible' })
    await running.page.keyboard.press('Escape')
    await popover.waitFor({ state: 'hidden' })
    await memoryItem.evaluate(element => element.blur())
    await memoryItem.focus()
    await popover.waitFor({ state: 'visible' })
    await running.page.keyboard.press('Escape')
    await popover.waitFor({ state: 'hidden' })
    await memoryItem.hover()
    await popover.waitFor({ state: 'visible' })
    await popover.locator('.remote-monitor-activity').waitFor({ state: 'visible' })
    await running.page.waitForFunction(() => {
      return document.querySelectorAll('.remote-monitor-popover .remote-monitor-table tbody tr').length > 0
    })
    assert.equal(await popover.locator('.anticon-close-circle').count(), 0)

    await popover.locator('.ant-btn-link').click()
    await running.page.locator('.right-side-panel').waitFor({ state: 'visible' })
    await running.page.locator('.right-side-panel [data-monitor-detail="cpu"]').waitFor({ state: 'visible' })
    await bar.waitFor({ state: 'hidden' })
    // the info panel reuses the bar's ItemFilter component
    await running.page.locator('.right-side-panel .item-filter').waitFor({ state: 'visible' })
    await running.page.locator('.right-side-panel-close').click()
    await bar.waitFor({ state: 'visible' })

    await bar.hover()
    await controls.locator('.item-filter').click()
    const filterList = running.page.locator('.item-filter-list:visible')
    await filterList.waitFor({ state: 'visible' })
    assert.equal(await filterList.locator('.item-filter-item').count(), 9)
    assert.equal(await filterList.locator('.item-filter-item-on').count(), 9)

    for (const id of defaultItems) {
      await filterList.locator(`[data-filter-item="${id}"]`).click()
    }
    await running.page.waitForFunction(() => {
      return window.store.config.remoteMonitorBarItems.length === 0
    })
    assert.equal(await bar.locator('.remote-monitor-item').count(), 0)
    assert.equal(await bar.locator('.remote-monitor-message').count(), 1)

    await filterList.locator('[data-filter-item="memory"]').click()
    await filterList.locator('[data-filter-item="users"]').click()
    const selectedItems = await running.page.evaluate(() => {
      return window.store.config.remoteMonitorBarItems
    })
    assert.deepEqual(selectedItems, ['memory', 'users'])

    assert.equal(
      await bar.locator('.remote-monitor-item').first().getAttribute('data-monitor-item'),
      'memory'
    )
    assert.equal(await bar.locator('[data-monitor-item="cpu"]').count(), 0)
    await delay(1200)

    await running.app.close()
    running = await launchApp()
    const persisted = await running.page.evaluate(() => ({
      enabled: window.store.config.remoteMonitorBarEnabled,
      items: window.store.config.remoteMonitorBarItems
    }))
    assert.equal(persisted.enabled, true)
    assert.deepEqual(persisted.items, ['memory', 'users'])

    await connectFixture(running.page)
    await dismissSshConfigNotify(running.page)
    const persistedBar = running.page.locator('.remote-monitor-bar')
    await persistedBar.waitFor({ state: 'visible' })
    assert.equal(
      await persistedBar.locator('.remote-monitor-item').first().getAttribute('data-monitor-item'),
      'memory'
    )
    assert.equal(await persistedBar.locator('[data-monitor-item="cpu"]').count(), 0)

    await persistedBar.hover()
    await persistedBar.locator('.remote-monitor-controls .ant-btn').first().click()
    await persistedBar.waitFor({ state: 'detached' })
  } finally {
    await running.app.close().catch(() => {})
  }
})

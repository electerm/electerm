const { _electron: electron } = require('@playwright/test')
require('dotenv').config()
const {
  test: it
} = require('@playwright/test')
const { describe } = it
// Four providers, each one a real request to a real server, with waits on the
// store instead of on the clock -- see waitSyncSettled below.
it.setTimeout(600000)
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('./common/expect')
const appOptions = require('./common/app-options')
const e = require('./common/lang')
const extendClient = require('./common/client-extend')
const { closeApp } = require('./common/common')
const {
  GIST_ID,
  GIST_TOKEN,
  GITEE_TOKEN,
  GITEE_ID,
  CUSTOM_SYNC_URL,
  CUSTOM_SYNC_USER,
  CUSTOM_SYNC_SECRET,
  CLOUD_TOKEN
} = process.env

// gitee regularly needs 30s+ to answer from a CI runner, and nothing in the
// request path carries a short timeout (the ws bridge allows 120s), so these
// are generous on purpose.
const syncSettleTimeout = 90000
const bookmarkWaitTimeout = 20000

// store.isSyncingSetting drives the <Spin> that wraps the whole sync panel
// (setting-sync.jsx). While a request is in flight antd lays a blur overlay
// over the form and that overlay eats pointer events, so a click landing during
// it retries until it times out -- which is how this spec failed with
// "ant-spin-container intercepts pointer events". Fixed delays cannot fix that,
// because the panel stays covered for however long the server takes.
async function waitSyncSettled (client) {
  // The click handler is async, so the flag can still read false right after
  // the click even though a request is about to start. Give it a moment to go
  // busy, then wait for it to clear again. A request that never went busy
  // (nothing to do, or already finished) settles immediately.
  await client.waitForFunction(
    () => window.store.isSyncingSetting === true,
    null, { timeout: 3000 }
  ).catch(() => {})
  await client.waitForFunction(
    () => window.store.isSyncingSetting !== true,
    null, { timeout: syncSettleTimeout }
  )
}

// The download only has to reach the store eventually. The old fixed delay
// read the store too early and turned a merely slow gitee into a bare
// `expected true, received false` with no hint that waiting would have fixed it.
async function waitBookmarks (client, min = 3) {
  await client.waitForFunction(
    n => (window.store.bookmarks || []).length > n,
    min,
    { timeout: bookmarkWaitTimeout }
  )
}

describe('data sync', function () {
  it('should open sync page', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    await delay(3500)

    async function checkNoError () {
      const hasError = await client.elemExist('.common-err-desc')
      expect(hasError).equal(false)
    }

    log('button:open sync')
    await client.click('.btns .anticon-cloud-sync')
    await delay(500)
    const sel = '.setting-wrap .ant-tabs-nav-list .ant-tabs-tab-active'
    await client.hasElem(sel)
    await delay(500)
    const text = await client.getText(sel)
    expect(text.toLowerCase()).equal(e('setting').toLowerCase())

    // create theme
    log('save github token / id')

    await client.setValue('#sync-input-token-github', GIST_TOKEN)
    await client.setValue('#sync-input-gistId-github', GIST_ID)
    await delay(1000)
    await client.click('.setting-wrap .sync-btn-save')
    await waitSyncSettled(client)
    await client.click('.setting-wrap .sync-btn-down')
    await waitSyncSettled(client)
    await waitBookmarks(client)
    const bks = await client.evaluate(() => {
      return window.store.bookmarks
    })
    expect(bks.length > 3).equal(true)
    await checkNoError()

    log('save gitee token / id')

    await client.click('.setting-wrap [id*="tab-gitee"]')
    await client.evaluate(() => {
      return window.store.setBookmarks([])
    })
    await delay(3000)

    await client.setValue('#sync-input-token-gitee', GITEE_TOKEN)
    await client.setValue('#sync-input-gistId-gitee', GITEE_ID)
    await delay(1000)
    await client.click('.setting-wrap .sync-btn-save:visible')
    await waitSyncSettled(client)
    await client.click('.setting-wrap .sync-btn-down:visible')
    await waitSyncSettled(client)
    await waitBookmarks(client)
    const bks1 = await client.evaluate(() => {
      return window.store.bookmarks
    })
    expect(bks1.length > 3).equal(true)
    await checkNoError()

    log('save custom props')

    await client.click('.setting-wrap [id*="tab-custom"]')
    await client.evaluate(() => {
      return window.store.setBookmarks([])
    })
    await delay(3000)

    await client.setValue('#sync-input-url-custom', CUSTOM_SYNC_URL)
    await client.setValue('#sync-input-token-custom', CUSTOM_SYNC_SECRET)
    await client.setValue('#sync-input-gistId-custom', CUSTOM_SYNC_USER)
    await delay(1000)
    await client.click('.setting-wrap .sync-btn-save:visible')
    await waitSyncSettled(client)
    await client.click('.setting-wrap .sync-btn-down:visible')
    await waitSyncSettled(client)
    await waitBookmarks(client)
    const bks3 = await client.evaluate(() => {
      return window.store.bookmarks
    })
    expect(bks3.length > 3).equal(true)
    await checkNoError()

    log('0192.sync.spec.js: save cloud props')

    await client.click('.setting-wrap [id*="tab-cloud"]')
    log('0192.sync.spec.js: cloud tab clicked')
    await delay(3000)

    await client.setValue('#sync-input-token-cloud', CLOUD_TOKEN)
    log('0192.sync.spec.js: cloud token set')
    await delay(1000)
    await client.click('.setting-wrap .sync-btn-save:visible')
    log('0192.sync.spec.js: cloud save clicked')
    await waitSyncSettled(client)
    await client.click('.setting-wrap .sync-btn-up:visible')
    log('0192.sync.spec.js: cloud up clicked')
    await waitSyncSettled(client)
    await client.evaluate(() => {
      return window.store.setBookmarks([])
    })
    log('0192.sync.spec.js: bookmarks cleared')
    await client.click('.setting-wrap .sync-btn-down:visible')
    log('0192.sync.spec.js: cloud down clicked')
    await waitSyncSettled(client)
    await waitBookmarks(client)
    const bks4 = await client.evaluate(() => {
      return window.store.bookmarks
    })
    expect(bks4.length > 3).equal(true)
    log('0192.sync.spec.js: cloud sync verified')

    await delay(1000)
    log('0192.sync.spec.js: calling close')
    await closeApp(electronApp, __filename)
    log('0192.sync.spec.js: app closed')
  })
})

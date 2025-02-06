const { _electron: electron } = require('@playwright/test')
require('dotenv').config()
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('./common/expect')
const appOptions = require('./common/app-options')
const e = require('./common/lang')
const extendClient = require('./common/client-extend')
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

describe('data sync', function () {
  it('all buttons open proper terminal themes tab', async function () {
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
    await delay(5000)
    await client.click('.setting-wrap .sync-btn-down')
    await delay(5000)
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
    await delay(6000)
    await client.click('.setting-wrap .sync-btn-down:visible')
    await delay(6000)
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
    await delay(6000)
    await client.click('.setting-wrap .sync-btn-down:visible')
    await delay(6000)
    const bks3 = await client.evaluate(() => {
      return window.store.bookmarks
    })
    expect(bks3.length > 3).equal(true)
    await checkNoError()

    log('save cloud props')

    await client.click('.setting-wrap [id*="tab-cloud"]')
    await delay(3000)

    await client.setValue('#sync-input-token-cloud', CLOUD_TOKEN)
    await delay(1000)
    await client.click('.setting-wrap .sync-btn-save:visible')
    await delay(6000)
    await client.click('.setting-wrap .sync-btn-up:visible')
    await delay(6000)
    await client.evaluate(() => {
      return window.store.setBookmarks([])
    })
    await client.click('.setting-wrap .sync-btn-down:visible')
    await delay(6000)
    const bks4 = await client.evaluate(() => {
      return window.store.bookmarks
    })
    expect(bks4.length > 3).equal(true)
    electronApp.close().catch(console.log)
  })
})

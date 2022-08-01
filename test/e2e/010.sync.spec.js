const { _electron: electron } = require('playwright')
require('dotenv').config()
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const { expect } = require('chai')
const appOptions = require('./common/app-options')
const prefixer = require('./common/lang')
const extendClient = require('./common/client-extend')
const {
  GIST_ID,
  GIST_TOKEN,
  GITEE_TOKEN,
  GITEE_ID
} = process.env

describe('data sync', function () {
  it('all buttons open proper terminal themes tab', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    const prefix = await prefixer(electron)
    const e = prefix('common')

    await delay(3500)

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

    await client.setValue('#setting-sync-form_token', GIST_TOKEN)
    await client.setValue('#setting-sync-form_gistId', GIST_ID)
    await delay(1000)
    await client.click('.setting-wrap .sync-btn-save')
    await delay(5000)
    await client.click('.setting-wrap .sync-btn-down')
    await delay(5000)
    const bks = await client.evaluate(() => {
      return window.store.getBookmarks()
    })
    expect(bks.length > 3).equal(true)

    log('save gitee token / id')

    await client.click('.setting-wrap [id*="tab-gitee"]')
    await client.evaluate(() => {
      return window.store.setBookmarks([])
    })
    await delay(3000)

    await client.setValue('.setting-wrap [placeholder="gitee personal access token"]', GITEE_TOKEN)
    await client.setValue('.setting-wrap [placeholder="gitee gist id"]', GITEE_ID)
    await delay(1000)
    await client.click('.setting-wrap .sync-btn-save:visible')
    await delay(6000)
    await client.click('.setting-wrap .sync-btn-down:visible')
    await delay(6000)
    const bks1 = await client.evaluate(() => {
      return window.store.getBookmarks()
    })
    expect(bks1.length > 3).equal(true)
  })
})

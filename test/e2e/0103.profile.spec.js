/**
 * quick commands test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { _electron: electron } = require('playwright')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('chai')
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('profile', function () {
  it('quick commands form', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    log('open setting')
    await delay(2000)
    await client.click('.btns .anticon-setting')
    await delay(2500)
    log('click profiles')
    await client.click('.setting-tabs [role="tab"]', 5)
    // await client.click('.setting-tabs [role="tab"]', 4)
    await client.setValue(
      '.setting-tabs-profile input#name',
      'profile1'
    )
    await client.setValue(
      '.setting-tabs-profile input#password',
      'zxd'
    )
    const qmlist1 = await client.countElem('.setting-tabs-profile .item-list-unit')
    await delay(150)
    await client.click('.setting-tabs-profile .ant-btn-primary')
    await delay(2550)
    const qmlist2 = await client.countElem('.setting-tabs-profile .item-list-unit')
    expect(qmlist2).equal(qmlist1 + 1)

    await delay(1150)
    const c1 = await client.evaluate(() => {
      return window.store.profiles.length
    })
    expect(qmlist1).equal(c1)
    await electronApp.close().catch(console.log)
  })
})

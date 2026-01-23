/**
 * quick commands test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('profile', function () {
  it('quick commands form', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    log('0103.profile.spec.js: open setting')
    await delay(2000)
    await client.click('.btns .anticon-setting')
    await delay(2500)
    log('0103.profile.spec.js: setting opened')
    log('0103.profile.spec.js: click profiles')
    await client.click('.setting-tabs [role="tab"]', 4)
    log('0103.profile.spec.js: profiles tab clicked')
    // await client.click('.setting-tabs [role="tab"]', 4)
    await client.setValue(
      '.setting-tabs-profile input#name',
      'profile1'
    )
    log('0103.profile.spec.js: name set')
    await client.setValue(
      '.setting-tabs-profile input#password',
      'zxd'
    )
    log('0103.profile.spec.js: password set')
    const qmlist1 = await client.countElem('.setting-tabs-profile .item-list-unit')
    await delay(150)
    await client.click('.setting-tabs-profile .ant-btn-primary')
    log('0103.profile.spec.js: save button clicked')
    await delay(2550)
    const qmlist2 = await client.countElem('.setting-tabs-profile .item-list-unit')
    expect(qmlist2).equal(qmlist1 + 1)
    log('0103.profile.spec.js: profile added')

    await delay(1150)
    const c1 = await client.evaluate(() => {
      return window.store.profiles.length
    })
    expect(qmlist1).equal(c1)
    log('0103.profile.spec.js: profile count verified')
    await electronApp.close().catch(console.log)
    log('0103.profile.spec.js: app closed')
  })
})

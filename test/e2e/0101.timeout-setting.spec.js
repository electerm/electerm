/**
 * timeout setting
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
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('timeout setting', function () {
  it('timeout setting works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(6000)

    log('set timeout to 100')
    await client.evaluate(() => {
      window.store.setConfig({
        sshReadyTimeout: 100
      })
    })
    await delay(400)

    const timeout = await client.evaluate(() => {
      return window.store.config.sshReadyTimeout
    })
    await delay(150)
    expect(timeout).equal(100)

    log('open new ssh and timeout')
    await client.click('.btns .anticon-plus-circle')
    await delay(6500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await client.click('.setting-wrap .ant-btn-primary')
    await delay(5500)
    const errSel = '.ant-notification-notice  .ant-notification-notice-content .common-err'
    for (let i = 0; i < 25; i++) {
      await delay(500)
      const errExist = await client.elemExist(errSel)
      if (errExist) {
        break
      }
    }
    const txt = await client.getText(errSel)
    expect(txt.includes('Timed out')).equal(true)

    log('set timeout to 50000')
    await delay(1500)
    await client.evaluate(() => {
      window.store.setConfig({
        sshReadyTimeout: 50000
      })
    })
    await delay(1555)
    const timeout1 = await client.evaluate(() => {
      return window.store.config.sshReadyTimeout
    })
    await delay(150)
    expect(timeout1).equal(50000)
    await delay(400)
    await electronApp.close().catch(console.log)
  })
})

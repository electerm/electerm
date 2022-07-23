/**
 * timeout setting
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
    delay(4000)

    log('set timeout to 100')
    await client.click('.btns .anticon-setting')
    await delay(1500)

    await client.evaluate(() => {
      window.store.config.sshReadyTimeout = 100
    })
    await delay(1500)

    const timeout = await client.evaluate(() => {
      return window.store.config.sshReadyTimeout
    })
    await delay(150)
    expect(timeout).equal(100)
    await client.click('.btns .anticon-setting')
    await delay(900)
    await client.hasElem('.setting-wrap', false)

    log('open new ssh and timeout')
    await client.click('.btns .anticon-plus-circle')
    await delay(2500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await client.click('.setting-wrap .ant-tabs-tabpane-active .ant-btn-primary')
    await delay(8500)
    const txt = await client.getText('.ant-notification-notice  .ant-notification-notice-content .common-err')
    expect(txt.includes('Timed out')).equal(true)

    log('set timeout to 50000')
    await client.click('.btns .anticon-setting')
    await delay(1500)
    await client.evaluate(() => {
      window.store.config.sshReadyTimeout = 50000
    })
    await delay(1555)
    const timeout1 = await client.evaluate(() => {
      return window.store.config.sshReadyTimeout
    })
    await delay(150)
    expect(timeout1).equal(50000)
    await client.click('.setting-wrap .close-setting-wrap')
    await delay(400)
    await client.hasElem('.setting-wrap', false)
    await electronApp.close().catch(console.log)
  })
})

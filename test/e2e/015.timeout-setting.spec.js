/**
 * timeout setting
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const { Application } = require('spectron')
const { expect } = require('chai')
const delay = require('./common/wait')
const log = require('./common/log')
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const isOs = require('./common/is-os')
const appOptions = require('./common/app-options')

if (isOs('darwin')) {
  return
}

describe('timeout setting', function () {
  this.timeout(100000)

  beforeEach(async function () {
    this.app = new Application(appOptions)
    return this.app.start()
  })

  afterEach(function () {
    if (this.app && this.app.isRunning()) {
      return this.app.stop()
    }
  })

  it('timeout setting works', async function () {
    const { client } = this.app

    await client.waitUntilWindowLoaded()
    delay(3000)
    log('open setting')
    await client.execute(function () {
      document.querySelector('.btns .anticon-setting').click()
    })
    await delay(1500)

    client.setValue(
      '.setting-wrap .ant-tabs-tabpane-active .timeout-desc .ant-input-number-input',
      100
    )
    await delay(150)
    await client.execute(function () {
      document.querySelector('.setting-wrap .close-setting-wrap').click()
    })
    await delay(900)
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await client.execute(function () {
      document.querySelector('.setting-wrap .ant-tabs-tabpane-active .ant-btn-primary').click()
    })
    await delay(3500)
    const txt = await client.getText('.ant-notification-notice  .ant-notification-notice-content .common-err')
    expect(txt.includes('Timed out')).equal(true)
    await client.execute(function () {
      document.querySelector('.btns .anticon-setting').click()
    })
    await delay(1500)
    client.setValue(
      '.setting-wrap .ant-tabs-tabpane-active .timeout-desc .ant-input-number-input',
      50000
    )
    await delay(555)
    await client.execute(function () {
      document.querySelector('.setting-wrap .close-setting-wrap').click()
    })
    await delay(400)
  })
})

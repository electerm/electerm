/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const { Application } = require('spectron')
const { expect } = require('chai')
const delay = require('./common/wait')
const basicTermTest = require('./common/basic-terminal-test')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const isOs = require('./common/is-os')

if (isOs('darwin')) {
  return
}

describe('ssh', function () {
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

  it('should open window and basic ssh ls command works', async function () {
    const { client } = this.app
    extendClient(client)
    const cmd = 'ls'
    await client.waitUntilWindowLoaded()
    await delay(3500)
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await client.click('.setting-wrap .ant-tabs-tabpane-active .ant-btn-primary')
    await delay(1500)
    const tabsCount = await client.elements('.tabs .tabs-wrapper .tab')

    expect(tabsCount.length).equal(2)
    await delay(2010)
    await basicTermTest(this, client, cmd)
  })
})

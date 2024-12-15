/**
 * basic ssh test
 * need TEST_HOST TEST_PASS TEST_USER env set
 */

const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER
} = require('./common/env')
const { _electron: electron } = require('@playwright/test')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const { basicTerminalTest } = require('./common/basic-terminal-test')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('ssh', function () {
  it('should open window and basic ssh ls command works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
    const cmd = 'ls'
    await delay(4500)
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await client.click('.setting-wrap .ant-btn-primary')
    await delay(5500)
    let tabsCount = await client.elements('.tabs .tabs-wrapper .tab')
    tabsCount = await tabsCount.count()
    expect(tabsCount).equal(2)
    await delay(4010)
    await basicTerminalTest(client, cmd)
    await electronApp.close().catch(console.log)
  })
})

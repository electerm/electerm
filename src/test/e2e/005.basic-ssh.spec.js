/**
 * basic ssh test
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
const { basicTerminalTest } = require('./common/basic-terminal-test')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { setupSshConnection } = require('./common/common')

describe('ssh', function () {
  it('should open window and basic ssh ls command works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
    const cmd = 'ls'
    await setupSshConnection(client)
    await delay(5500)
    let tabsCount = await client.elements('.tabs .tabs-wrapper .tab')
    tabsCount = await tabsCount.count()
    expect(tabsCount).equal(2)
    await delay(4010)
    await basicTerminalTest(client, cmd)
    await electronApp.close().catch(console.log)
  })
})

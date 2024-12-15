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
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('ssh', function () {
  it('should open window and basic ssh ls command works', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
    await delay(4500)
    await client.rightClick('.tabs .tab', 10, 10)
    await client.click('.context-menu.show .anticon-copy')
    await delay(4500)
    const tabsCount = await client.evaluate(() => {
      return window.store.tabs.length
    })
    expect(tabsCount).equal(2)
  })
})

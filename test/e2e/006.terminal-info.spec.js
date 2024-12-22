/**
 * info panel test
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

describe('info panel', function () {
  it('info panel should work in both local and ssh terminals', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)

    // Get initial activeTabId
    const initialTabId = await client.evaluate(() => {
      return window.store.activeTabId
    })

    // Test local terminal info panel
    log('click info icon for local terminal')
    await client.click('.terminal-footer-info .terminal-info-icon')
    await delay(1000)

    await client.hasElem('.right-side-panel')

    let panelContent = await client.getText('.right-side-panel-content')
    expect(panelContent).includes(initialTabId)

    // Create SSH connection
    log('create ssh connection')
    await client.click('.btns .anticon-plus-circle')
    await delay(500)
    await client.setValue('#ssh-form_host', TEST_HOST)
    await client.setValue('#ssh-form_username', TEST_USER)
    await client.setValue('#ssh-form_password', TEST_PASS)
    await client.click('.setting-wrap .ant-btn-primary')
    await delay(8500)

    // Get SSH tab ID and verify info panel content
    const sshTabId = await client.evaluate(() => {
      return window.store.activeTabId
    })
    expect(sshTabId !== initialTabId).equal(true)

    panelContent = await client.getText('.right-side-panel-content')
    expect(panelContent).includes(sshTabId)
    expect(panelContent).includes(TEST_HOST)

    // Switch back to local tab
    log('switch back to local tab')
    await client.click('.tabs .tab', 0)
    await delay(1000)

    panelContent = await client.getText('.right-side-panel-content')
    expect(panelContent).includes(initialTabId)
    expect(panelContent.includes(TEST_HOST)).equal(false)

    // Close info panel
    log('close info panel')
    await client.click('.right-side-panel-close')
    await delay(500)

    const panelCount = await client.countElem('.right-side-panel')
    expect(panelCount).equal(0)

    await electronApp.close().catch(console.log)
  })
})

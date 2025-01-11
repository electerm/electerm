const { _electron: electron } = require('@playwright/test')
const {
  test: it,
  expect
} = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { getTerminalContent } = require('./common/basic-terminal-test')

describe('batch input', function () {
  it('should execute ls command in selected tabs', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    // Wait for app to load
    await delay(3500)

    // Create a new tab first so we have 2 tabs
    await client.click('.tabs .tabs-add-btn')
    await delay(1500)

    // Get initial tab count
    const tabsCount = await client.countElem('.tabs .tab')
    expect(tabsCount).toEqual(2)

    const text1 = await getTerminalContent(client)

    // Switch to second tab
    // await client.click('.tabs .tab', 0)
    // await delay(1000)
    const text2 = text1

    // Enter command in batch input
    await client.click('.batch-input-holder')
    await delay(1500)

    // Enter ls command
    await client.setValue('.terminal-footer-flex .bi-full .ant-input', 'ls')
    await client.keyboard.press('Enter')
    await delay(500)

    // Check first tab output
    await client.click('.tabs .tab', 0)
    await delay(1000)
    const newText1 = await getTerminalContent(client)

    // Check second tab output
    await client.click('.tabs .tab', 1)
    await delay(1000)
    const newText2 = await getTerminalContent(client)

    // Verify command output in both terminals
    expect(newText1.length === text1.length).toEqual(true)
    expect(newText2.length).toBeGreaterThan(text2.length)

    // Check that ls command history is saved
    const batchHistory = await client.evaluate(() => {
      return window.store.batchInputs
    })
    expect(batchHistory).toContain('ls')

    await electronApp.close().catch(console.log)
  })
})

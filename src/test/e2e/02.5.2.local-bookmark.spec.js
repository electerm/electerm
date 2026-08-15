const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const { nanoid } = require('nanoid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('Local bookmark', function () {
  it('should create a local bookmark and verify history', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    await delay(3500)

    // Get initial history count
    const initialHistoryCount = await client.evaluate(() => {
      return window.store.history.length
    })

    // Open bookmark form
    await client.click('.btns .anticon-plus-circle')
    await delay(500)

    // Select local bookmark type
    await client.click('.setting-wrap .ant-radio-button-wrapper', 3)
    await delay(500)

    // Generate a unique title for the bookmark
    const bookmarkTitle = `Local-${nanoid()}`
    const type = 'local'

    // Fill in bookmark details
    await client.setValue('.setting-wrap input[id="local-form_title"]', bookmarkTitle)
    await client.setValue('.setting-wrap textarea[id="local-form_runScripts_0_script"]', 'ls')

    // Save and connect
    await client.click('.setting-wrap .ant-btn-primary')
    await delay(2000)

    // Verify that the history has been updated
    const historyItem = await client.evaluate(() => {
      const history = window.store.history
      return history[0]
    })

    expect(historyItem.tab.title).toEqual(bookmarkTitle)
    expect(historyItem.tab.type).toEqual(type)

    // Verify history count has increased
    const newHistoryCount = await client.evaluate(() => {
      return window.store.history.length
    })
    expect(newHistoryCount).toEqual(initialHistoryCount + 1)

    await electronApp.close().catch(console.log)
  })
})

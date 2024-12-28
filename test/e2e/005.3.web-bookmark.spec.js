const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const { nanoid } = require('nanoid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('Web session', function () {
  it('should create a web bookmark and verify history and webview', async function () {
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

    // Select web bookmark type
    await client.click('.setting-wrap .ant-radio-button-wrapper', 4)
    await delay(500)

    // Generate test data
    const bookmarkTitle = 'Web-' + nanoid()
    const testUrl = 'https://github.com'
    const type = 'web'

    // Fill in bookmark details
    await client.setValue('.setting-wrap input[id="web-form_title"]', bookmarkTitle)
    await client.setValue('.setting-wrap input[id="web-form_url"]', testUrl)

    // Save and connect
    await client.click('.setting-wrap .ant-btn-primary')
    await delay(2000)

    // Verify history has been updated
    const historyItem = await client.evaluate(() => {
      const history = window.store.history
      return history[0]
    })

    expect(historyItem.tab.title).toEqual(bookmarkTitle)
    expect(historyItem.tab.type).toEqual(type)
    expect(historyItem.tab.url).toEqual(testUrl)

    // Verify history count has increased
    const newHistoryCount = await client.evaluate(() => {
      return window.store.history.length
    })
    expect(newHistoryCount).toEqual(initialHistoryCount + 1)

    // Verify webview loaded the correct URL
    await delay(2000)
    const webviewUrl = await client.evaluate(() => {
      const webview = document.querySelector('webview')
      return webview ? webview.getAttribute('src') : ''
    })
    expect(webviewUrl).toEqual(testUrl + '/')

    await electronApp.close().catch(console.log)
  })
})

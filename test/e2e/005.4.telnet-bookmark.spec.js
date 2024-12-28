const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const { nanoid } = require('nanoid')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { basicTerminalTest } = require('./common/basic-terminal-test')

describe('Telnet bookmark', function () {
  it('should create a telnet bookmark and verify connection', async function () {
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

    // Select telnet bookmark type
    await client.click('.setting-wrap .ant-radio-button-wrapper:has-text("Telnet")')
    await delay(500)

    // Generate a unique title for the bookmark
    const bookmarkTitle = `Telnet-${nanoid()}`
    const testHost = 'telehack.com'
    const testPort = '23' // standard telnet port
    const type = 'telnet'

    // Fill in bookmark details using SSH form IDs
    await client.setValue('#ssh-form_host', testHost)
    await client.setValue('#ssh-form_title', bookmarkTitle)
    await client.setValue('#ssh-form_port', testPort)

    // Save and connect
    await client.click('.setting-wrap .ant-btn-primary')
    await delay(5000) // Need longer delay for telnet connection

    // Verify that the history has been updated
    const historyItem = await client.evaluate(() => {
      const history = window.store.history
      return history[0]
    })
    expect(historyItem.tab.title).toEqual(bookmarkTitle)
    expect(historyItem.tab.host).toEqual(testHost)
    expect(historyItem.tab.port).toEqual(Number(testPort))
    expect(historyItem.tab.type).toEqual(type)

    // Verify history count has increased
    const newHistoryCount = await client.evaluate(() => {
      return window.store.history.length
    })
    expect(newHistoryCount).toEqual(initialHistoryCount + 1)

    // Verify terminal has connected and shows some output
    await delay(2000)
    await basicTerminalTest(client, 'help')

    await electronApp.close().catch(console.log)
  })
})

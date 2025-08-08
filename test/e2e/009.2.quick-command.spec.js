/**
 * quick commands execution test
 */
const { _electron: electron } = require('@playwright/test')
const {
  test: it,
  expect
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { getTerminalContent } = require('./common/basic-terminal-test')

describe('quick commands execution', function () {
  it('should execute quick command when clicked in quick command box', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    await delay(3500)

    const initialContent = await getTerminalContent(client)
    await client.evaluate(() => {
      window.store.addQuickCommand({
        name: 'ls',
        commands: [
          {
            command: 'ls',
            id: Date.now() + '',
            delay: 100
          }
        ]
      })
    })

    // Open quick command box by hovering the trigger
    log('open quick command box')
    await client.hover('.quick-command-trigger-wrap .ant-btn')
    await delay(1000)

    // Verify quick command box is visible
    // const quickCommandBox = await client.element('.quick-command-box')
    // await expect(quickCommandBox).toBeVisible()

    // Click the quick command created in previous test
    log('execute quick command')
    await client.click('.qm-item')
    await delay(1000)

    // Get new terminal content
    const newContent = await getTerminalContent(client)

    // Verify command was executed
    await expect(newContent.length).toBeGreaterThan(initialContent.length)
    await electronApp.close().catch(console.log)
  })
})

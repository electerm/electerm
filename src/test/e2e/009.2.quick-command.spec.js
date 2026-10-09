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

    // The quick-command panel has two homes — the footer box and the right side
    // panel — and the choice is a persisted preference, so a developer who left
    // it docked would otherwise get the right panel here instead of the box.
    await client.evaluate(() => window.store.setQuickCommandsInRightPanel(false))
    await delay(200)

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
    await client.click('.quick-command-trigger-wrap .ant-btn')
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

  it('should send every step to the tab it started in, even after a tab switch', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    await delay(3500)

    const tabA = await client.evaluate(() => window.store.activeTabId)
    await client.evaluate(() => window.store.addTab())
    await delay(3500)
    const tabB = await client.evaluate(() => window.store.activeTabId)
    expect(tabB).not.toEqual(tabA)

    await client.evaluate((id) => window.store.clickTab(id), tabA)
    await delay(1000)

    const qmId = 'qm-tab-' + Date.now()
    await client.evaluate((id) => {
      window.store.addQuickCommand({
        id,
        name: 'tab binding',
        commands: [1, 2, 3].map(n => ({
          id: id + '-' + n,
          command: 'echo QMTAB-STEP' + n,
          delay: n === 1 ? 100 : 2500
        }))
      })
    }, qmId)
    await delay(500)

    log('run quick command in tab A, then switch to tab B mid-run')
    await client.evaluate((id) => window.store.runQuickCommandItem(id), qmId)
    await delay(1000)
    await client.evaluate((id) => window.store.clickTab(id), tabB)
    await delay(6000)

    // which steps produced output in each tab
    const outputs = await client.evaluate(({ tabA, tabB }) => {
      const steps = id => {
        const buf = window.refs.get('term-' + id)?.term?.buffer.active
        const lines = []
        const count = buf ? buf.length : 0
        for (let i = 0; i < count; i++) {
          lines.push(buf.getLine(i).translateToString(true).trim())
        }
        return [1, 2, 3].filter(n => lines.includes('QMTAB-STEP' + n))
      }
      return { a: steps(tabA), b: steps(tabB) }
    }, { tabA, tabB })

    expect(outputs.a).toEqual([1, 2, 3])
    expect(outputs.b).toEqual([])
    await electronApp.close().catch(console.log)
  })
})

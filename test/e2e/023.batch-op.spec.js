/**
 * Batch Operation e2e test
 *
 * Verifies:
 *  1. Widgets panel opens with the Batch Operation widget
 *  2. Editor is displayed with "Execute Workflow" button
 *  3. Load Template populates the editor
 *  4. Executing a workflow (connect + command via test SSH server)
 *     shows progress in the log div
 *  5. Log entries appear for each step (success / error)
 */

const { _electron: electron } = require('@playwright/test')
const { test: it } = require('@playwright/test')
const { describe } = it
it.setTimeout(10000000)

const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { expect } = require('./common/expect')
const {
  TEST_HOST,
  TEST_PASS,
  TEST_USER,
  TEST_PORT
} = require('./common/env')

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Open the Widgets settings panel via the store API */
async function openWidgetsPanel (client) {
  await client.evaluate(() => window.store.openWidgetsModal())
  await delay(800)
}

/** Click the first widget whose list-item title contains `name` */
async function clickWidgetByName (client, name) {
  const item = client.locator(`.item-list-unit .list-item-title:has-text("${name}")`)
  await item.first().click()
  await delay(500)
}

/** Return the current text content of the batch-op log div */
async function getLogText (client) {
  const el = client.locator('.batch-op-logs')
  const count = await el.count()
  if (count === 0) return ''
  return el.first().innerText()
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('batch-op', function () {
  it('should open Batch Operation widget and show log div after execution', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    await client.waitForFunction(() => window.store && window.store.configLoaded === true, { timeout: 15000 })
    await delay(500)
    log('023-batch-op: app launched')

    // ── step 1: open widgets panel ─────────────────────────────────────────
    await openWidgetsPanel(client)
    log('023-batch-op: widgets panel opened')

    // ── step 2: click the Batch Operation widget ──────────────────────────
    await clickWidgetByName(client, 'Batch Operation')
    await delay(600)
    log('023-batch-op: Batch Operation widget selected')

    // Editor and Execute button should be visible
    const editorVisible = await client.locator('.batch-op-editor').count()
    expect(editorVisible).greaterThan(0)
    const execBtn = client.locator('button:has-text("Execute Workflow")')
    expect(await execBtn.count()).greaterThan(0)
    log('023-batch-op: editor and execute button visible')

    // ── step 3: load template and verify editor populated ─────────────────
    await client.click('button:has-text("Load Template")')
    await delay(400)
    const editorVal = await client.evaluate(() => {
      // The SimpleEditor renders a textarea
      const ta = document.querySelector('.batch-op-editor textarea')
      return ta ? ta.value : ''
    })
    expect(editorVal.length).greaterThan(10)
    log('023-batch-op: template loaded into editor')

    // ── step 4: set a minimal workflow JSON using test SSH creds ──────────
    const workflow = JSON.stringify([
      {
        name: 'Connect SSH',
        action: 'connect',
        host: TEST_HOST,
        port: parseInt(TEST_PORT, 10),
        username: TEST_USER,
        authType: 'password',
        password: TEST_PASS,
        enableSftp: false
      },
      {
        name: 'Run Command',
        action: 'command',
        command: 'echo batch-op-test'
      },
      {
        name: 'Wait after command',
        action: 'delay',
        duration: 3000
      }
    ], null, 2)

    await client.evaluate((json) => {
      const ta = document.querySelector('.batch-op-editor textarea')
      if (ta) {
        // Trigger React onChange
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        nativeInputValueSetter.call(ta, json)
        ta.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, workflow)
    await delay(400)
    log('023-batch-op: workflow JSON set')

    // ── step 5: execute workflow ───────────────────────────────────────────
    await execBtn.first().click()
    log('023-batch-op: execute clicked, waiting for workflow to run...')

    // Wait until the log div appears (up to 45 s for SSH connect + command)
    await client.waitForFunction(() => {
      const el = document.querySelector('.batch-op-logs')
      return el && el.innerText.length > 0
    }, { timeout: 45000 })
    await delay(1000)
    log('023-batch-op: log div appeared')

    const logText = await getLogText(client)
    log(`023-batch-op: log content: ${logText}`)

    // At minimum the log div must exist
    const logCount = await client.locator('.batch-op-logs').count()
    expect(logCount).greaterThan(0)

    // At least one log entry should be present
    const entryCount = await client.locator('.batch-op-log-entry').count()
    expect(entryCount).greaterThan(0)
    log(`023-batch-op: ${entryCount} log entries found`)

    await electronApp.close().catch(console.log)
  })

  it('should show error log entry when a step fails', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    await client.waitForFunction(() => window.store && window.store.configLoaded === true, { timeout: 15000 })
    await delay(500)

    await openWidgetsPanel(client)
    await clickWidgetByName(client, 'Batch Operation')
    await delay(600)

    // Use a bad host so the connect step fails immediately
    const workflow = JSON.stringify([
      {
        name: 'Bad Connect',
        action: 'connect',
        host: '192.0.2.1', // TEST-NET – guaranteed unreachable
        port: 22,
        username: 'nobody',
        authType: 'password',
        password: 'wrong'
      }
    ], null, 2)

    await client.evaluate((json) => {
      const ta = document.querySelector('.batch-op-editor textarea')
      if (ta) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        nativeInputValueSetter.call(ta, json)
        ta.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, workflow)
    await delay(400)

    const execBtn = client.locator('button:has-text("Execute Workflow")')
    await execBtn.first().click()
    log('023-batch-op: error-test execute clicked')

    // Wait for log div with an error entry (timeout ~35 s for connection attempt)
    await client.waitForFunction(() => {
      const entries = document.querySelectorAll('.batch-op-log-entry.error')
      return entries.length > 0
    }, { timeout: 35000 })

    const errorCount = await client.locator('.batch-op-log-entry.error').count()
    expect(errorCount).greaterThan(0)
    log(`023-batch-op: ${errorCount} error log entries found`)

    await electronApp.close().catch(console.log)
  })
})

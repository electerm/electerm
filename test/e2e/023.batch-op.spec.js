/**
 * Batch Operation e2e test
 *
 * Verifies:
 *  1. Widgets panel opens with the Batch Operation widget
 *  2. Editor is displayed with "Execute Workflow" button
 *  3. Load Template populates the editor
 *  4. Executing the full example workflow (connect + command + sftp_download +
 *     sftp_upload + cleanup) shows progress in the log div
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
const batchOpExample = require('./common/batch-op-example')

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

/** Inject workflow JSON into the editor textarea via React synthetic event */
async function setWorkflow (client, workflow) {
  await client.evaluate((json) => {
    const ta = document.querySelector('.batch-op-editor textarea')
    if (ta) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      nativeInputValueSetter.call(ta, json)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, JSON.stringify(workflow, null, 2))
  await delay(400)
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('batch-op', function () {
  it('should run full example workflow and show log entries for every step', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)

    await client.waitForFunction(() => window.store && window.store.configLoaded === true, { timeout: 15000 })
    await delay(500)
    log('023-batch-op: app launched')

    // ── open widgets panel ─────────────────────────────────────────────────
    await openWidgetsPanel(client)
    log('023-batch-op: widgets panel opened')

    // ── click the Batch Operation widget ──────────────────────────────────
    await clickWidgetByName(client, 'Batch Operation')
    await delay(600)
    log('023-batch-op: Batch Operation widget selected')

    // Editor and Execute button should be visible
    const editorVisible = await client.locator('.batch-op-editor').count()
    expect(editorVisible).greaterThan(0)
    const execBtn = client.locator('button:has-text("Execute Workflow")')
    expect(await execBtn.count()).greaterThan(0)
    log('023-batch-op: editor and execute button visible')

    // ── Load Template and verify editor populated ──────────────────────────
    await client.click('button:has-text("Load Template")')
    await delay(400)
    const editorVal = await client.evaluate(() => {
      const ta = document.querySelector('.batch-op-editor textarea')
      return ta ? ta.value : ''
    })
    expect(editorVal.length).greaterThan(10)
    log('023-batch-op: template loaded into editor')

    // ── set the full example workflow (connect + commands + sftp) ──────────
    await setWorkflow(client, batchOpExample)
    log('023-batch-op: example workflow JSON set')

    // ── execute workflow ───────────────────────────────────────────────────
    await execBtn.first().click()
    log('023-batch-op: execute clicked, waiting for all steps...')

    // Wait until all steps complete (log div has success/error entries)
    // Workflow has 7 steps; allow up to 3 minutes for sftp transfers
    await client.waitForFunction(() => {
      const entries = document.querySelectorAll('.batch-op-log-entry')
      return entries.length >= 7
    }, { timeout: 180000 })
    await delay(1000)

    const logText = await getLogText(client)
    log(`023-batch-op: log content:\n${logText}`)

    // Every step should have a success entry
    const successCount = await client.locator('.batch-op-log-entry.success').count()
    expect(successCount).greaterThan(0)
    log(`023-batch-op: ${successCount} success log entries found`)

    // There should be no error entries
    const errorCount = await client.locator('.batch-op-log-entry.error').count()
    expect(errorCount).equal(0)
    log('023-batch-op: no error entries — all steps passed')

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
    const workflow = [
      {
        name: 'Bad Connect',
        action: 'connect',
        params: {
          host: '192.0.2.1', // TEST-NET – guaranteed unreachable
          port: 22,
          username: 'nobody',
          authType: 'password',
          password: 'wrong'
        }
      }
    ]

    await setWorkflow(client, workflow)

    const execBtn = client.locator('button:has-text("Execute Workflow")')
    await execBtn.first().click()
    log('023-batch-op: error-test execute clicked')

    // Wait for an error entry (up to ~35 s for connection timeout)
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

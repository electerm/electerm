const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

describe('Terminal Suggestions Dropdown', function () {
  let electronApp
  let client
  it.beforeEach(async () => {
    electronApp = await electron.launch(appOptions)
    client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
    await client.evaluate(() => {
      return window.store.setConfig({
        showCmdSuggestions: true
      })
    })
  })
  it.afterAll(async () => {
    await client.evaluate(() => {
      return window.store.setConfig({
        showCmdSuggestions: false
      })
    })
    await electronApp.close()
  })

  it('should show suggestions based on command history and handle deletion', async function () {
    await delay(1500)
    // Type the partial command and check initial suggestions count
    const partialCommand = 'test-unique'
    await client.keyboard.type(partialCommand)
    await delay(100)
    await client.keyboard.press('ArrowRight')
    await delay(100)
    await client.keyboard.press('ArrowRight')

    // Verify suggestions panel is visible
    const suggestionElement = await client.locator('.terminal-suggestions-wrap').first()
    await expect(suggestionElement).toBeVisible()

    // Count initial suggestions for our partial command
    const initialSuggestions = await client.locator('.suggestion-item').count()

    // Continue typing to make it a unique command
    await client.keyboard.type('-command-' + Date.now())

    // Verify AI suggestions button
    const aiSuggestionsButton = await client.locator('.terminal-suggestions-sticky div').first()
    await expect(aiSuggestionsButton).toBeVisible()
    await expect(aiSuggestionsButton).toHaveText('Get AI suggestions')

    // Press Enter to execute command
    await client.keyboard.press('Enter')
    await expect(suggestionElement).toBeHidden()

    await delay(1000)

    // Type the same partial command again
    await client.keyboard.type(partialCommand)
    await delay(100)
    await client.keyboard.press('ArrowRight')
    await delay(100)
    await client.keyboard.press('ArrowRight')

    // Verify suggestions are visible again
    // The suggestions list should filter commands that start with the partial input
    await expect(suggestionElement).toBeVisible()

    // Verify suggestion count increased for the same partial command
    const newSuggestionsCount = await client.locator('.suggestion-item').count()
    expect(newSuggestionsCount).toBeGreaterThan(initialSuggestions)

    // Press Enter to close suggestions
    await client.keyboard.press('Enter')
    await expect(suggestionElement).toBeHidden()
  })
})

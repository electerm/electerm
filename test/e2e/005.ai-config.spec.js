const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { spawn } = require('child_process')
const path = require('path')

describe('AI Config and Suggestions', function () {
  let aiServer
  let electronApp
  let client

  // Start AI API server before all tests
  it.beforeAll(async () => {
    const serverPath = path.join(__dirname, 'common', 'ai-api.js')
    aiServer = spawn('node', [serverPath])
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for server to start
  })

  // Stop AI API server after all tests
  it.afterAll(() => {
    if (aiServer) {
      aiServer.kill()
    }
  })

  it.beforeEach(async () => {
    electronApp = await electron.launch(appOptions)
    client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(4500)
  })

  it.afterEach(async () => {
    await electronApp.close()
  })

  it('should open AI setting page and fill configuration', async function () {
    // Click AI button to open settings
    await client.evaluate(() => {
      return window.store.setConfig({
        showCmdSuggestions: true
      })
    })
    await client.click('.terminal-footer-ai .ai-icon')
    await delay(1000)

    // Verify AI setting page is open
    await expect(client.locator('.setting-wrap .ai-config-form')).toBeVisible()

    // Fill in the AI configuration form
    await client.fill('#baseURLAI', 'http://localhost:43434')
    await client.fill('#apiPathAI', '/chat/completions')
    await client.fill('#modelAI', 'gpt-3.5-turbo')
    await client.fill('#apiKeyAI', 'test-api-key')
    await client.fill('#roleAI', 'You are a helpful assistant')
    await client.fill('#languageAI', 'English')

    // Save the configuration
    await client.click('.ai-config-form button[type="submit"]')
    await delay(1000)

    // Close the setting panel
    await client.click('.close-setting-wrap-icon')
    await delay(1000)

    // Verify the setting panel is closed
    await expect(client.locator('.setting-wrap')).not.toBeVisible()
  })

  it('should verify AI functionality after configuration', async function () {
    // Click AI button after configuration
    await client.click('.terminal-footer-ai .ai-icon')
    await delay(1000)

    // Verify that the AI setting page does not open this time
    await expect(client.locator('.setting-wrap .ai-config-form')).not.toBeVisible()

    // Verify that AI functionality is triggered instead
    await expect(client.locator('.ai-chat-container')).toBeVisible()
  })

  it('should test AI suggestions functionality', async function () {
    // Open a terminal or ensure we're in a context where we can input commands
    // You might need to add steps here to open a terminal tab if it's not open by default

    // Input a command
    const testCommand = 'test'
    await client.type('.xterm-helper-textarea', testCommand)
    await delay(500)

    // Get the initial count of suggestions
    const initialSuggestionsCount = await client.locator('.suggestion-item').count()

    // Click the "Get AI suggestions" button
    await client.click('.terminal-suggestions-sticky div:has-text("Get AI suggestions")')
    await delay(2000) // Wait for suggestions to load

    // Get the new count of suggestions
    const newSuggestionsCount = await client.locator('.suggestion-item').count()

    // Verify that the number of suggestions has increased
    expect(newSuggestionsCount).toBeGreaterThan(initialSuggestionsCount)

    // Verify that the new suggestions start with the input command
    const suggestions = await client.locator('.suggestion-item').allTextContents()
    for (const suggestion of suggestions) {
      expect(suggestion.startsWith(testCommand)).toBeTruthy()
    }
  })
})

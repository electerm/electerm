const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { spawn } = require('child_process')
const path = require('path')

describe('Terminal Explain with AI', function () {
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
    await client.evaluate(() => {
      return window.store.setConfig({
        showCmdSuggestions: false
      })
    })
    await electronApp.close()
  })

  it('should explain selected text with AI', async function () {
    // Type some text in the terminal
    await client.evaluate(() => {
      return window.store.setConfig({
        showCmdSuggestions: true
      })
    })
    const testCommand = 'ls -la'
    await client.type('.xterm-helper-textarea', testCommand)
    await client.keyboard.press('Enter')
    await delay(1000)

    // Use terminal's built-in select all command (usually Cmd+A or Ctrl+A)
    await client.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await delay(500)

    // Right-click to open context menu
    await client.rightClick('.term-wrap', 10, 10)
    await delay(500)

    // Click "Explain with AI" in the context menu
    await client.click('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Explain with AI")')

    // Verify that the AI panel is opened
    await expect(client.locator('.ai-chat-container')).toBeVisible()

    // Verify that the selected text is sent to AI for explanation
    // await delay(500)
    // const aiChatTextarea = client.locator('.ai-chat-textarea')
    // await expect(aiChatTextarea).toHaveValue('explain terminal output')

    // Verify that the AI response is received
    await delay(3000) // Wait for AI response
    const aiResponse = client.locator('.chat-history-item:last-child')
    await expect(aiResponse).toBeVisible()

    // Check if the response contains some expected content
    await expect(aiResponse).toContainText('Response to your query', { timeout: 10000 })

    // Verify that the response is not empty
    const responseText = await aiResponse.textContent()
    expect(responseText.length).toBeGreaterThan(0)
  })
})

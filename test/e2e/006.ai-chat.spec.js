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

  it('should verify AI functionality after configuration', async function () {
    // Open AI chat
    await client.click('.terminal-footer-ai .ai-icon')
    await delay(1000)

    // Verify AI chat is open
    await expect(client.locator('.ai-chat-container')).toBeVisible()

    // Get initial chat history count
    const initialHistoryCount = await client.locator('.chat-history-item').count()

    // Enter a test prompt
    const testPrompt = 'Hello, AI assistant! Please provide a long response.'
    await client.fill('.ai-chat-textarea', testPrompt)

    // Submit the prompt
    await client.click('.ai-chat-terminals .anticon-send')
    
    // Wait for response (adjust delay if needed)
    await delay(5000)

    // Get new chat history count
    const newHistoryCount = await client.locator('.chat-history-item').count()

    // Verify chat history increased by 1
    expect(newHistoryCount).toBe(initialHistoryCount + 1)

    // Verify the last chat history item contains the test prompt
    const lastChatItem = await client.locator('.chat-history-item').last()
    const promptContent = await lastChatItem.locator('.ant-alert-message').textContent()
    expect(promptContent).toContain(testPrompt)

    // Check for truncated content and "show full content" button
    const showFullContentButton = lastChatItem.locator('.pointer:has-text("full content")')
    await expect(showFullContentButton).toBeVisible()

    // Get initial content length
    const initialContent = await lastChatItem.locator('.pd1').textContent()

    // Click "show full content" button
    await showFullContentButton.click()
    await delay(1000)

    // Verify full content is shown
    const fullContent = await lastChatItem.locator('.pd1').textContent()
    expect(fullContent.length).toBeGreaterThan(initialContent.length)

    // Verify "show full content" button is no longer visible
    await expect(showFullContentButton).not.toBeVisible()

    // Test clear history functionality
    await client.click('.ai-chat-terminals .clear-ai-icon')
    await delay(1000)

    // Verify that the chat history is now empty
    const finalHistoryCount = await client.locator('.chat-history-item').count()
    expect(finalHistoryCount).toBe(0)
  })
})

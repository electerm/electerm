const { _electron: electron } = require('@playwright/test')
const { test: it, expect } = require('@playwright/test')
const { describe } = it
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const configureMockAI = require('./common/configure-mock-ai')
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
    const selectedId = await client.evaluate(configureMockAI)
    await client.evaluate(configureMockAI, {
      id: 'e2e-initial-provider',
      nameAI: 'Initial provider',
      apiPathAI: '/initial/chat/completions'
    })
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
    // Switch after typing, with the draft already held by the submit callback.
    const selector = client.locator('.ai-chat-config-select')
    await expect(selector).toContainText('Initial provider')
    await selector.click()
    await client.locator('.ant-select-item-option').getByText('Mock chat provider', { exact: true }).click()
    await expect(selector).toContainText('Mock chat provider')

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
    const promptContent = await lastChatItem.locator('.ant-alert-title').textContent()
    expect(promptContent).toContain(testPrompt)

    // The mock answer ends with a GFM table. react-markdown only parses
    // CommonMark unless remark-gfm is enabled, in which case the table arrives
    // as literal `| a | b |` text and never becomes a <table> at all.
    const table = client.locator('.ai-stream-output table').last()
    await expect(table).toBeVisible({ timeout: 15000 })
    const savedTurn = await client.evaluate(() => ({ ...window.store.aiChatHistory.at(-1) }))
    expect(savedTurn.aiConfigId).toBe(selectedId)
    expect(savedTurn).not.toHaveProperty('apiKeyAI')
    expect(savedTurn).not.toHaveProperty('proxyAI')
    expect(await table.locator('thead th').count()).toBe(3)
    expect(await table.locator('tbody tr').count()).toBe(2)
    expect(await table.locator('thead th').first().textContent()).toBe('Name')
    // and it must actually be styled, not just present
    const thBorder = await table.locator('thead th').first().evaluate(
      el => window.getComputedStyle(el).borderTopStyle
    )
    expect(thBorder).toBe('solid')

    // Test new chat functionality (clears the current conversation)
    await client.click('.ai-chat-toolbar .new-chat-btn')
    await delay(1000)

    // Verify that the chat history is now empty
    const finalHistoryCount = await client.locator('.chat-history-item').count()
    expect(finalHistoryCount).toBe(0)
  })
})

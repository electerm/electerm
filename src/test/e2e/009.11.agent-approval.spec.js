const { test, expect, _electron: electron } = require('@playwright/test')
const { mkdtempSync, rmSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')
const appOptions = require('./common/app-options')
const configureMockAI = require('./common/configure-mock-ai')
const e = require('./common/lang')

test.describe('Agent tool approvals', () => {
  let app, client, dialog, dataDir

  test.beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'electerm-agent-approval-'))
    const args = appOptions.args.filter(arg => !arg.startsWith('--user-data-dir='))
    app = await electron.launch({
      ...appOptions,
      args: [...args, '--user-data-dir=' + join(dataDir, 'profile')],
      env: { ...appOptions.env, DATA_PATH: dataDir }
    })
    client = await app.firstWindow()
    await client.waitForFunction(() => window.store?.activeTabId && !window.store.initLoadingData)
    await client.evaluate(configureMockAI)
    await client.evaluate(() => {
      const { store, pre } = window
      const run = pre.runGlobalAsync
      // Exercise the real composer, tool loop and modal. Stub only the provider
      // reply and the operations whose dispatch we want to observe.
      pre.runGlobalAsync = async (name, ...args) => {
        if (name !== 'AIchatWithTools') return run(name, ...args)
        const tool = window.nextAgentTool
        window.nextAgentTool = null
        if (!tool) return { message: { role: 'assistant', content: 'done' } }
        return {
          message: {
            role: 'assistant',
            tool_calls: [{ id: 'approval-test', type: 'function', function: tool }]
          }
        }
      }
      window.dispatchedTools = []
      store.mcpSendTerminalCommand = ({ command, tabId }) => {
        window.lastTarget = tabId
        window.dispatchedTools.push(command)
      }
      store.mcpWaitForTerminalIdle = async () => ({ idle: true })
      store.mcpRunBackgroundCommand = ({ command }) => window.dispatchedTools.push(command)
      store.mcpSftpDel = ({ remotePath }) => window.dispatchedTools.push(remotePath)
      store.setConfig({ showCmdSuggestions: false })
    })
    await client.evaluate(() => window.store.handleOpenAIPanel())
    await client.locator('.ai-chat-controls .ant-segmented-item').filter({ hasText: 'Agent' }).click()
    dialog = client.locator('.agent-approval-modal')
  })

  test.afterEach(async () => {
    try {
      await app?.close()
    } finally {
      if (dataDir) rmSync(dataDir, { recursive: true, force: true })
    }
  })

  async function requestTool (name, args) {
    await client.evaluate(tool => {
      window.store.handleOpenAIPanel()
      window.nextAgentTool = tool
    }, { name, arguments: JSON.stringify(args) })
    const prompt = client.locator('.ai-chat-textarea')
    await prompt.fill('Request ' + name)
    await prompt.press('Enter')
  }

  async function expectDispatched (expected) {
    await client.waitForFunction(() => !window.nextAgentTool && !window.store.agentRunning)
    expect(await client.evaluate(() => window.dispatchedTools)).toEqual(expected)
    await expect(dialog).toBeHidden()
  }

  async function confirm (remember = false) {
    if (remember) await dialog.getByRole('checkbox', { name: e('agentAlwaysAllowCommand') }).check()
    await dialog.locator('button.ant-btn-primary').click()
  }

  test('approves once, remembers exact commands and honors edits in Common Settings', async () => {
    const command = 'echo hello'
    const variant = command + ' again'
    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    expect(await client.evaluate(() => window.dispatchedTools)).toEqual([])
    await confirm()
    await expectDispatched([command])

    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    await confirm(true)
    await expectDispatched([command, command])

    await requestTool('run_background_command', { command })
    await expectDispatched([command, command, command])
    await requestTool('send_terminal_command', { command: variant })
    await expect(dialog).toContainText(variant)
    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expectDispatched([command, command, command])
    await expect(client.locator('.agent-tool-stopped')).toHaveCount(1)

    await requestTool('send_terminal_command', { command, inputOnly: true })
    await expect(dialog).toContainText('inputOnly')
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    await dialog.press('Escape')
    await expectDispatched([command, command, command])

    await client.evaluate(() => window.store.openSetting())
    const allowlist = client.getByLabel(e('agentCommandAllowlist'), { exact: true })
    await expect(allowlist).toHaveValue(command)
    await allowlist.fill(variant)
    await allowlist.blur()
    await client.locator('.alt-close-setting-wrap').click()
    await requestTool('send_terminal_command', { command: variant })
    await expectDispatched([command, command, command, variant])
    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    await dialog.press('Escape')
    await expectDispatched([command, command, command, variant])
    await client.reload()
    await client.waitForFunction(() => window.store?.activeTabId && !window.store.initLoadingData)
    await client.evaluate(() => window.store.openSetting())
    await expect(allowlist).toHaveValue(variant)
  })

  test('can stop a pending non-shell tool and switch to auto approval', async () => {
    const args = { remotePath: '/example.txt' }
    await requestTool('sftp_del', args)
    await expect(dialog).toContainText(args.remotePath)
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    // Trigger the normal stop handler while a modal covers the chat panel.
    await client.locator('.ai-stop-icon-square').dispatchEvent('click')
    await expectDispatched([])

    await client.evaluate(() => window.store.openSetting())
    const settings = client.locator('.setting-wrap')
    await settings.getByRole('combobox', { name: e('permission'), exact: true }).click()
    await expect(settings.locator('label[for="agentApprovalMode"]')).toHaveCount(0)
    await client.locator('.ant-select-dropdown:visible').getByText(e('agentAutoApproval'), { exact: true }).click()
    await client.locator('.alt-close-setting-wrap').click()
    await requestTool('sftp_del', args)
    await expectDispatched([args.remotePath])
    const toolbar = client.locator('.ai-chat-toolbar')
    await expect(toolbar.locator('.ant-select')).toContainText(e('agentAutoApproval'))
    await toolbar.getByRole('combobox', { name: e('permission'), exact: true }).click()
    await client.locator('.ant-select-dropdown:visible').getByText(e('agentManualApproval'), { exact: true }).click()

    await requestTool('sftp_del', args)
    await expect(dialog).toContainText(args.remotePath)
    await client.evaluate(() => window.store.toggleInfoPanel())
    await expect(client.locator('.ai-chat-textarea')).toBeHidden()
    await expect(dialog).toBeVisible()
    await dialog.press('Escape')
    await expectDispatched([args.remotePath])
  })

  test('keeps the reviewed terminal target and honors a revocation in another window', async () => {
    const command = 'pwd'
    const target = await client.evaluate(() => window.store.activeTabId)
    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(target)
    await client.evaluate(() => window.store.mcpOpenLocalTerminal())
    await expect.poll(() => client.evaluate(() => window.store.activeTabId)).not.toBe(target)
    await confirm(true)
    await expectDispatched([command])
    expect(await client.evaluate(() => window.lastTarget)).toBe(target)

    // Load a static asset in a second same-origin window to share browser
    // storage without starting another terminal session.
    const asset = new URL('/icons/folder.svg', client.url()).href
    await app.evaluate(async ({ BrowserWindow }, asset) => {
      const second = new BrowserWindow({ show: false })
      try {
        await second.loadURL(asset)
        await second.webContents.executeJavaScript("localStorage.removeItem('agentCommandAllowlist')")
      } finally {
        second.destroy()
      }
    }, asset)
    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    await dialog.press('Escape')
    await expectDispatched([command])
  })
})

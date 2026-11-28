const { test, expect, _electron: electron } = require('@playwright/test')
const { existsSync, mkdtempSync, rmSync } = require('fs')
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
      window.realTerminalTools = {
        mcpSendTerminalCommand: store.mcpSendTerminalCommand,
        mcpWaitForTerminalIdle: store.mcpWaitForTerminalIdle,
        mcpRunBackgroundCommand: store.mcpRunBackgroundCommand
      }
      window.dispatchedTools = []
      store.mcpListTabs = () => {
        window.dispatchedTools.push('list_tabs')
        return []
      }
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

  async function openAISettings () {
    await client.evaluate(() => window.store.openSetting())
    await client.locator('.item-type-setting').getByText('AI', { exact: true }).click()
  }

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

  async function waitForShellPrompt () {
    await client.waitForFunction(() => {
      const { isIdle, output } = window.store.mcpGetTerminalStatus({})
      return isIdle && /[#$%>]\s*$/.test(output)
    })
  }

  async function confirm (remember = false) {
    if (remember) {
      const name = await client.evaluate(() => window.translate('agentAlwaysAllowCommand'))
      await dialog.getByRole('checkbox', { name }).check()
    }
    await dialog.locator('button.ant-btn-primary').click()
  }

  test('groups AI preferences after Terminal and opens the active provider from that page', async () => {
    const providerSettings = 'AI ' + e('settings')
    const providerPicker = client.getByRole('combobox', { name: providerSettings, exact: true })
    const settings = client.locator('.setting-wrap')
    const chatConfig = client.locator('.ai-chat-config-controls')
    const options = client.locator('.ant-select-dropdown:visible')
    await client.evaluate(configureMockAI, { id: 'second-provider', nameAI: 'Second provider' })
    await client.evaluate(() => window.store.openSetting())
    const menu = client.locator('.item-type-setting')
    await expect(menu.locator('.item-list-unit:nth-child(-n + 3) .list-item-title')).toHaveText([
      e('common'), e('terminal'), 'AI'
    ])
    const allowlist = client.getByLabel(e('agentCommandAllowlist'), { exact: true })
    await expect(allowlist).toHaveCount(0)
    await menu.getByText(e('terminal'), { exact: true }).click()
    await expect(allowlist).toHaveCount(0)
    await menu.getByText('AI', { exact: true }).click()
    await expect(allowlist).toBeVisible()
    await expect(settings.getByText('Second provider', { exact: true })).toBeVisible()
    await settings.locator(providerPicker).click()
    await options.getByText('Mock chat provider', { exact: true }).click()

    const autoCompress = settings.getByRole('switch', { name: e('autoCompress'), exact: true })
    await expect(autoCompress).not.toBeChecked()
    await autoCompress.click()
    await client.locator('.alt-close-setting-wrap').click()
    await expect(chatConfig.getByText('Mock chat provider', { exact: true })).toBeVisible()
    await chatConfig.locator(providerPicker).click()
    await options.getByText('Second provider', { exact: true }).click()
    await client.locator('.ai-chat-toolbar').getByRole('button', { name: e('autoCompress') }).click()
    await expect(client.locator('.ai-auto-compress-popover').getByRole('switch')).toBeChecked()
    await expect.poll(() => client.evaluate(async () => {
      const saved = await window.pre.runGlobalAsync('dbAction', 'data', 'findOne', { _id: 'userConfig' })
      return saved?.activeAIConfigId
    })).toBe('second-provider')
    await client.reload()
    await client.waitForFunction(() => window.store?.activeTabId && !window.store.initLoadingData)
    await openAISettings()
    await expect(autoCompress).toBeChecked()
    await expect(settings.getByText('Second provider', { exact: true })).toBeVisible()

    await settings.getByRole('button', { name: providerSettings, exact: true }).click()
    await expect(client.getByRole('tab', { name: providerSettings, exact: true, selected: true })).toBeVisible()
    await expect(client.locator('#nameAI')).toHaveValue('Second provider')
  })

  for (const mode of ['Ask', 'Agent']) {
    test(`sends on Enter from chat history in ${mode} mode without opening a card`, async () => {
      const controls = client.locator('.ai-chat-controls')
      await controls.locator('.ant-segmented-item').getByText(mode, { exact: true }).click()
      await expect(controls.getByRole('combobox', { name: e('permission'), exact: true })).toHaveCount(mode === 'Agent' ? 1 : 0)
      const sessionId = await client.evaluate(() => window.store.currentChatSessionId)
      await client.evaluate(() => {
        const run = window.pre.runGlobalAsync
        window.chatRequests = []
        window.pre.runGlobalAsync = async (name, ...args) => {
          if (name === 'AIchat' || name === 'AIchatWithTools') {
            const prompt = name === 'AIchat' ? args[0] : args[0].at(-1).content
            window.chatRequests.push({ name, prompt })
            return name === 'AIchat'
              ? { response: 'Reply received' }
              : { message: { role: 'assistant', content: 'Reply received' } }
          }
          return run(name, ...args)
        }
      })
      const requests = () => client.evaluate(() => window.chatRequests)
      const history = client.locator('.ai-chat-toolbar').getByRole('button', { name: e('history'), exact: true })
      await expect(history).toHaveText('')
      await history.click()
      await expect(client.locator('.ai-chat-sessions-empty')).toBeVisible()
      const composer = client.locator('.ai-chat-textarea')
      await composer.fill('First line')
      await composer.press('Shift+Enter')
      await client.keyboard.insertText('Second line')
      const prompt = 'First line\nSecond line'
      await expect(composer).toHaveValue(prompt)
      expect(await requests()).toEqual([])
      await composer.press('Enter')

      const expected = [{ name: mode === 'Ask' ? 'AIchat' : 'AIchatWithTools', prompt }]
      await expect.poll(requests).toEqual(expected)
      await expect(client.locator('.ai-stream-output')).toContainText('Reply received')
      expect(await client.evaluate(() => window.store.aiChatHistory.at(-1).chatSessionId)).toBe(sessionId)
      await history.click()
      await client.locator('.ai-chat-session-item').click()
      await expect(client.locator('.ai-stream-output')).toContainText('Reply received')
      expect(await requests()).toEqual(expected)

      if (mode === 'Ask') {
        const followUp = 'Second question'
        await composer.fill(followUp)
        await composer.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, isComposing: true })
        await expect(composer).toHaveValue(followUp)
        expect(await requests()).toEqual(expected)
        await composer.press('Control+Enter')
        await expect(client.locator('.ai-stream-output')).toHaveCount(2)
        expect(await requests()).toEqual([...expected, { name: 'AIchat', prompt: followUp }])
      }
    })
  }

  test('keeps a submitted turn at the history limit and across navigation during the reply', async () => {
    await client.evaluate(() => {
      window.store.aiChatHistory = Array.from({ length: 500 }, (_, i) => ({
        id: 'old-' + i,
        chatSessionId: 'earlier-session',
        timestamp: i + 1,
        prompt: 'Previous question',
        response: 'Previous answer',
        pending: false
      }))
      const run = window.pre.runGlobalAsync
      window.submittedPrompts = []
      window.pre.runGlobalAsync = async (name, ...args) => {
        if (name !== 'AIchatWithTools') return run(name, ...args)
        window.submittedPrompts.push(args[0].at(-1).content)
        await new Promise(resolve => { window.finishReply = resolve })
        return { message: { role: 'assistant', content: 'Newest answer' } }
      }
    })
    const prompt = 'Newest question'
    const composer = client.locator('.ai-chat-textarea')
    await composer.fill(prompt)
    await composer.press('Enter')
    const requests = () => client.evaluate(() => window.submittedPrompts)
    await expect.poll(requests).toEqual([prompt])
    const stop = client.locator('.chat-history-item .ai-stop-icon-square')
    await expect(stop).toBeVisible()
    await client.locator('.ai-chat-toolbar').getByRole('button', { name: e('history'), exact: true }).click()
    await client.locator('.ai-chat-session-item').filter({ hasText: prompt }).click()
    await expect(stop).toBeVisible()
    expect(await requests()).toEqual([prompt])

    await client.evaluate(() => window.finishReply())
    await expect(client.locator('.ai-stream-output')).toContainText('Newest answer')
    await expect(stop).toBeHidden()
    const retained = await client.evaluate(() => {
      const entries = window.store.aiChatHistory
      return { count: entries.length, first: entries[0].id, last: entries.at(-1).prompt }
    })
    expect(retained).toEqual({ count: 500, first: 'old-1', last: prompt })
    expect(await requests()).toEqual([prompt])
  })

  test('runs reads without persisting an approval and reviews other uses of the same command', async () => {
    const command = 'whoami'
    await requestTool('list_tabs', {})
    await expectDispatched(['list_tabs'])
    await waitForShellPrompt()
    await requestTool('send_terminal_command', { command })
    await expectDispatched(['list_tabs', command])
    expect(await client.evaluate(() => window.localStorage.getItem('agentCommandAllowlist'))).toBeNull()

    await requestTool('run_background_command', { command })
    await expect(dialog).toContainText('run_background_command')
    await dialog.press('Escape')
    await expectDispatched(['list_tabs', command])

    await requestTool('send_terminal_command', { command, inputOnly: true })
    await expect(dialog).toContainText('inputOnly')
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    await dialog.press('Escape')
    await expectDispatched(['list_tabs', command])

    // The same foreground read would append to an unfinished terminal command.
    await client.evaluate(() => window.refs.get('term-' + window.store.activeTabId).attachAddon.sendToServer('echo pending'))
    await expect.poll(() => client.evaluate(() => window.store.mcpGetTerminalOutput({ lines: 2 }).output)).toContain('echo pending')
    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    await dialog.press('Escape')
    await expectDispatched(['list_tabs', command])
    await client.evaluate(() => window.refs.get('term-' + window.store.activeTabId).attachAddon.sendToServer('\x03'))
  })

  test('asks before dispatch when inspection of the terminal throws', async () => {
    await waitForShellPrompt()
    await client.evaluate(() => {
      const session = window.refs.get('term-' + window.store.activeTabId)
      window.shellInspections = 0
      session.startupQueue.getLocalExec = () => {
        window.shellInspections++
        throw new Error('Terminal state unavailable')
      }
    })
    const command = 'whoami'
    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    expect(await client.evaluate(() => window.shellInspections)).toBeGreaterThan(0)
    expect(await client.evaluate(() => window.dispatchedTools)).toEqual([])
    await confirm()
    await expectDispatched([command])
  })

  test('asks every time before reading sensitive SFTP or shell paths, including saved commands', async () => {
    const command = 'cat /example/.ssh/id_rsa'
    const remotePath = '/example/.aws/credentials'
    await client.evaluate(() => {
      window.store.mcpSftpReadFile = ({ remotePath }) => {
        window.dispatchedTools.push(remotePath)
        return { content: 'synthetic test content' }
      }
    })
    await openAISettings()
    const allowlist = client.getByLabel(e('agentCommandAllowlist'), { exact: true })
    await allowlist.fill(command)
    await allowlist.blur()
    await client.locator('.alt-close-setting-wrap').click()
    await openAISettings()
    await expect(allowlist).toHaveValue(command)
    await client.locator('.alt-close-setting-wrap').click()
    await waitForShellPrompt()

    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    expect(await client.evaluate(() => window.dispatchedTools)).toEqual([])
    await confirm()
    await expectDispatched([command])
    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    await dialog.press('Escape')
    await expectDispatched([command])

    await requestTool('sftp_read_file', { remotePath })
    await expect(dialog).toContainText(remotePath)
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    expect(await client.evaluate(() => window.dispatchedTools)).toEqual([command])
    await confirm()
    await expectDispatched([command, remotePath])
    await requestTool('sftp_read_file', { remotePath })
    await expect(dialog).toContainText(remotePath)
    await dialog.press('Escape')
    await expectDispatched([command, remotePath])
  })

  test('approves once, remembers exact commands and honors edits in AI settings', async () => {
    const command = 'mkdir reports'
    const variant = 'mkdir reports/archive'
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
    const activity = client.locator('.chat-history-item').last().locator('.ai-activity')
    await expect(activity.locator('summary')).toContainText(e('stopped'))
    await activity.locator('summary').click()
    await expect(activity.locator('.agent-tool-stopped .agent-tool-status')).toHaveText(e('stopped'))

    await requestTool('send_terminal_command', { command, inputOnly: true })
    await expect(dialog).toContainText('inputOnly')
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    await dialog.press('Escape')
    await expectDispatched([command, command, command])

    await openAISettings()
    const allowlist = client.getByLabel(e('agentCommandAllowlist'), { exact: true })
    await expect(allowlist).toHaveValue(command)
    await allowlist.fill([variant, variant, ''].join('\r\n'))
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
    await openAISettings()
    await expect(allowlist).toHaveValue(variant)
  })

  test('approves once and restores the saved settings list when storage is full', async () => {
    const savedCommand = 'projectctl refresh'
    const label = require('@electerm/electerm-locales').zh_cn.lang.agentCommandAllowlist
    const allowlist = client.getByLabel(label, { exact: true })
    const count = client.locator('#agentCommandCount')
    await client.evaluate(() => {
      window.store.setConfig({ language: 'zh_cn' })
    })
    await openAISettings()
    await allowlist.fill(savedCommand)
    await allowlist.blur()
    await expect(count).toHaveText('1 / 200')
    await client.locator('.alt-close-setting-wrap').click()
    await client.evaluate(() => {
      const original = window.Storage.prototype.setItem
      window.allowlistWriteAttempts = 0
      window.Storage.prototype.setItem = function (key, value) {
        if (this === window.localStorage && key === 'agentCommandAllowlist') {
          window.allowlistWriteAttempts++
          throw new window.DOMException('Storage quota reached', 'QuotaExceededError')
        }
        return original.call(this, key, value)
      }
    })
    const command = 'mkdir reports'
    await requestTool('send_terminal_command', { command })
    await confirm(true)
    await expect(client.locator('.message-item.warning')).toContainText('Approved for this run. The command couldn’t be saved to the allowed commands list.')
    await expectDispatched([command])
    await expect(client.locator('.agent-tool-completed')).toHaveCount(1)
    expect(await client.evaluate(() => window.allowlistWriteAttempts)).toBeGreaterThan(0)

    await requestTool('send_terminal_command', { command })
    await expect(dialog).toContainText(command)
    await dialog.press('Escape')
    await expectDispatched([command])

    await openAISettings()
    await expect(allowlist).toHaveValue(savedCommand)
    await allowlist.fill([savedCommand, command].join('\n'))
    await allowlist.blur()
    await expect(client.locator('.message-item.error')).toContainText('Couldn’t save this permission setting.')
    await expect(allowlist).toHaveValue(savedCommand)
    await expect(count).toHaveText('1 / 200')
  })

  test('reports a failed change to automatic approval and keeps asking', async () => {
    await client.evaluate(() => {
      const original = window.Storage.prototype.setItem
      window.Storage.prototype.setItem = function (key, value) {
        if (this === window.localStorage && key === 'agentApprovalMode') {
          throw new window.DOMException('Storage quota reached', 'QuotaExceededError')
        }
        return original.call(this, key, value)
      }
    })
    const controls = client.locator('.ai-chat-controls')
    await controls.getByRole('combobox', { name: e('permission'), exact: true }).click()
    await client.locator('.ant-select-dropdown:visible').getByText(e('agentAutoApproval'), { exact: true }).click()
    await expect(client.locator('.message-item.error')).toContainText('Couldn’t save this permission setting.')
    await expect(controls.locator('.ant-select')).toContainText(e('agentManualApproval'))
    await requestTool('sftp_del', { remotePath: '/example.txt' })
    await expect(dialog).toContainText('/example.txt')
    await dialog.press('Escape')
    await expectDispatched([])
  })

  test('can stop a pending non-shell tool and switch to auto approval', async () => {
    const args = { remotePath: '/example.txt' }
    await requestTool('sftp_del', args)
    await expect(dialog).toContainText(args.remotePath)
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    // Trigger the normal stop handler while a modal covers the chat panel.
    await client.locator('.ai-stop-icon-square').dispatchEvent('click')
    await expectDispatched([])

    await openAISettings()
    const settings = client.locator('.setting-wrap')
    await settings.getByRole('combobox', { name: e('permission'), exact: true }).click()
    await expect(settings.locator('label[for="agentApprovalMode"]')).toHaveCount(0)
    await client.locator('.ant-select-dropdown:visible').getByText(e('agentAutoApproval'), { exact: true }).click()
    await client.locator('.alt-close-setting-wrap').click()
    await requestTool('sftp_del', args)
    await expectDispatched([args.remotePath])
    const controls = client.locator('.ai-chat-controls')
    await expect(controls.locator('.ant-select')).toContainText(e('agentAutoApproval'))
    await controls.getByRole('combobox', { name: e('permission'), exact: true }).click()
    await client.locator('.ant-select-dropdown:visible').getByText(e('agentManualApproval'), { exact: true }).click()

    await requestTool('sftp_del', args)
    await expect(dialog).toContainText(args.remotePath)
    await client.evaluate(() => window.store.toggleInfoPanel())
    await expect(client.locator('.ai-chat-textarea')).toBeHidden()
    await expect(dialog).toBeVisible()
    await dialog.press('Escape')
    await expectDispatched([args.remotePath])
  })

  test('starts a real background task with approval and reads its log and status without prompting', async () => {
    test.skip(process.platform === 'win32', 'The background runner uses nohup and a POSIX shell')
    await client.evaluate(() => { Object.assign(window.store, window.realTerminalTools) })
    await waitForShellPrompt()
    const lastToolCall = async () => {
      await client.waitForFunction(() => !window.nextAgentTool && !window.store.agentRunning)
      return client.evaluate(() => window.store.aiChatHistory.at(-1).toolCalls.at(-1))
    }
    const finishedResult = async () => {
      const call = await lastToolCall()
      expect(call.status, call.result).toBe('completed')
      return JSON.parse(call.result)
    }

    const command = 'echo agent-monitor-ready'
    await requestTool('run_background_command', { command })
    await expect(dialog).toContainText(command)
    await confirm()
    const task = await finishedResult()
    const { taskId } = task
    try {
      await expect.poll(() => existsSync(task.exitFile)).toBe(true)
      await waitForShellPrompt()
      await requestTool('get_background_task_log', { taskId, lines: 1 })
      expect((await finishedResult()).output).toBe('agent-monitor-ready')
      await requestTool('get_background_task_status', { taskId })
      expect(await finishedResult()).toMatchObject({ id: taskId, status: 'completed', exitCode: 0 })
      await requestTool('get_background_task_log', { taskId, lines: 'one' })
      expect(await lastToolCall()).toMatchObject({ status: 'error', result: 'Expected a non-negative integer for lines' })

      const pending = 'echo agent-input-pending'
      const terminalLine = () => client.evaluate(() => window.store.mcpGetTerminalOutput({ lines: 1 }).output)
      await client.evaluate(input => window.refs.get('term-' + window.store.activeTabId).attachAddon.sendToServer(input), pending)
      await expect.poll(terminalLine).toContain(pending)
      const originalLine = await terminalLine()
      await requestTool('get_background_task_log', { taskId, lines: 1 })
      expect(await lastToolCall()).toMatchObject({ status: 'error', result: expect.stringContaining('empty POSIX shell prompt') })
      expect(await terminalLine()).toBe(originalLine)
      await expect(dialog).toBeHidden()
    } finally {
      for (const file of [task.logFile, task.pidFile, task.exitFile]) rmSync(file, { force: true })
    }
  })

  test('keeps the reviewed terminal target and honors a revocation in another window', async () => {
    const command = 'projectctl refresh'
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

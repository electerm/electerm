/**
 * MCP (Model Context Protocol) handler for store
 * Handles IPC requests from the MCP server widget
 */

import uid from '../common/uid'
import { settingMap } from '../common/constants'
import { refs, refsTabs } from '../components/common/ref'
import { runCmd } from '../components/terminal/terminal-apis'
import deepCopy from 'json-deep-copy'
import {
  getLocalFileInfo,
  getRemoteFileInfo
} from '../components/sftp/file-read'
import {
  fixBookmarkData,
  validateBookmarkData
} from '../components/bookmark-form/fix-bookmark-default'
import newTerm from '../common/new-terminal'

export default Store => {
  // Initialize MCP handler - called when MCP widget is started
  Store.prototype.initMcpHandler = function () {
    const { ipcOnEvent } = window.pre
    // Listen for MCP requests from main process
    ipcOnEvent('mcp-request', (event, request) => {
      const { requestId, action, data } = request
      if (action === 'tool-call') {
        window.store.handleMcpToolCall(requestId, data.toolName, data.args)
      }
    })
  }

  // Handle individual tool calls
  Store.prototype.handleMcpToolCall = async function (requestId, toolName, args) {
    const { store } = window

    try {
      let result

      switch (toolName) {
        // Bookmark operations
        case 'list_bookmarks':
          result = store.mcpListBookmarks(args)
          break
        case 'get_bookmark':
          result = store.mcpGetBookmark(args)
          break
        case 'add_bookmark':
          result = await store.mcpAddBookmark(args)
          break
        case 'edit_bookmark':
          result = store.mcpEditBookmark(args)
          break
        case 'delete_bookmark':
          result = store.mcpDeleteBookmark(args)
          break
        case 'open_bookmark':
          result = store.mcpOpenBookmark(args)
          break

        // Bookmark group operations
        case 'list_bookmark_groups':
          result = store.mcpListBookmarkGroups()
          break
        case 'add_bookmark_group':
          result = await store.mcpAddBookmarkGroup(args)
          break
        /*
        case 'list_quick_commands':
          result = store.mcpListQuickCommands()
          break
        case 'add_quick_command':
          result = store.mcpAddQuickCommand(args)
          break
        case 'run_quick_command':
          result = store.mcpRunQuickCommand(args)
          break
        case 'delete_quick_command':
          result = store.mcpDeleteQuickCommand(args)
          break
          */
        // Tab operations
        case 'list_tabs':
          result = store.mcpListTabs()
          break
        case 'get_active_tab':
          result = store.mcpGetActiveTab()
          break
        case 'switch_tab':
          result = store.mcpSwitchTab(args)
          break
        case 'close_tab':
          result = store.mcpCloseTab(args)
          break
        case 'reload_tab':
          result = store.mcpReloadTab(args)
          break
        case 'duplicate_tab':
          result = store.mcpDuplicateTab(args)
          break
        case 'open_local_terminal':
          result = store.mcpOpenLocalTerminal()
          break
        case 'open_tab':
          result = store.mcpOpenTab(args)
          break

        // Terminal operations
        case 'send_terminal_command':
          result = store.mcpSendTerminalCommand(args)
          break
        case 'get_terminal_selection':
          result = store.mcpGetTerminalSelection(args)
          break
        case 'get_terminal_output':
          result = store.mcpGetTerminalOutput(args)
          break
        case 'wait_for_terminal_idle':
          result = await store.mcpWaitForTerminalIdle(args)
          break
        case 'get_terminal_status':
          result = store.mcpGetTerminalStatus(args)
          break
        case 'cancel_terminal_command':
          result = store.mcpCancelTerminalCommand(args)
          break

        // Background task operations
        case 'run_background_command':
          result = store.mcpRunBackgroundCommand(args)
          break
        case 'get_background_task_status':
          result = await store.mcpGetBackgroundTaskStatus(args)
          break
        case 'get_background_task_log':
          result = await store.mcpGetBackgroundTaskLog(args)
          break
        case 'cancel_background_task':
          result = await store.mcpCancelBackgroundTask(args)
          break

        // SFTP operations
        case 'sftp_list':
          result = await store.mcpSftpList(args)
          break
        case 'sftp_del':
          result = await store.mcpSftpDel(args)
          break
        case 'sftp_stat':
          result = await store.mcpSftpStat(args)
          break
        case 'sftp_read_file':
          result = await store.mcpSftpReadFile(args)
          break

        // File transfer operations
        case 'sftp_upload':
          result = await store.mcpSftpUpload(args)
          break
        case 'sftp_download':
          result = await store.mcpSftpDownload(args)
          break

        // Transfer list/history operations
        case 'sftp_transfer_list':
          result = store.mcpSftpTransferList()
          break
        case 'sftp_transfer_history':
          result = store.mcpSftpTransferHistory()
          break

        // Zmodem (trzsz/rzsz) operations
        case 'zmodem_upload':
          result = store.mcpZmodemUpload(args)
          break
        case 'zmodem_download':
          result = store.mcpZmodemDownload(args)
          break

        // Settings operations
        case 'get_settings':
          result = store.mcpGetSettings()
          break

        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }

      window.api.sendMcpResponse({
        requestId,
        result
      })
    } catch (error) {
      window.api.sendMcpResponse({
        requestId,
        error: error.message
      })
    }
  }

  // ==================== Bookmark APIs ====================

  const bookmarkSensitiveFields = [
    'password', 'privateKey', 'passphrase', 'certificate', 'proxy',
    'connectionHoppings', 'sshTunnels'
  ]
  const bookmarkFeatureFields = [
    'connectionHoppings', 'sshTunnels', 'quickCommands', 'runScripts'
  ]

  function sanitizeBookmark (b) {
    const safe = Object.fromEntries(
      Object.entries(b).filter(([k]) => !bookmarkSensitiveFields.includes(k))
    )
    for (const key of bookmarkFeatureFields) {
      if (Array.isArray(b[key]) && b[key].length) {
        safe[`has${key.charAt(0).toUpperCase() + key.slice(1)}`] = true
      }
    }
    return safe
  }

  Store.prototype.mcpListBookmarks = function () {
    return deepCopy(window.store.bookmarks).map(sanitizeBookmark)
  }

  Store.prototype.mcpGetBookmark = function (args) {
    const { store } = window
    const bookmark = store.bookmarks.find(b => b.id === args.id)
    if (!bookmark) {
      throw new Error(`Bookmark not found: ${args.id}`)
    }
    return deepCopy(sanitizeBookmark(bookmark))
  }

  Store.prototype.mcpAddBookmark = async function (args) {
    const { store } = window
    const bookmark = fixBookmarkData({
      id: uid(),
      ...args
    })

    const { valid, errors } = validateBookmarkData(bookmark)
    if (!valid) {
      throw new Error(errors.join(', '))
    }

    store.addItem(bookmark, settingMap.bookmarks)

    return {
      success: true,
      id: bookmark.id,
      message: `Bookmark "${bookmark.title}" created`
    }
  }

  Store.prototype.mcpEditBookmark = function (args) {
    const { store } = window
    const { id, updates } = args

    const bookmark = store.bookmarks.find(b => b.id === id)
    if (!bookmark) {
      throw new Error(`Bookmark not found: ${id}`)
    }

    store.editItem(id, updates, settingMap.bookmarks)

    return {
      success: true,
      message: `Bookmark "${bookmark.title}" updated`
    }
  }

  Store.prototype.mcpDeleteBookmark = function (args) {
    const { store } = window
    store.delItem({ id: args.id }, settingMap.bookmarks)

    return {
      success: true,
      message: `Bookmark "${args.id}" deleted`
    }
  }

  Store.prototype.mcpOpenBookmark = function (args) {
    const { store } = window
    const bookmark = store.bookmarks.find(b => b.id === args.id)
    if (!bookmark) {
      throw new Error(`Bookmark not found: ${args.id}`)
    }

    store.onSelectBookmark(args.id)

    return {
      success: true,
      message: `Opened bookmark "${bookmark.title}"`
    }
  }

  // ==================== Bookmark Group APIs ====================

  Store.prototype.mcpListBookmarkGroups = function () {
    return deepCopy(window.store.bookmarkGroups)
  }

  Store.prototype.mcpAddBookmarkGroup = async function (args) {
    const { store } = window
    const group = {
      id: uid(),
      title: args.title,
      bookmarkIds: [],
      bookmarkGroupIds: [],
      level: args.parentId ? 2 : 1
    }

    await store.addBookmarkGroup(group)

    return {
      success: true,
      id: group.id,
      message: `Bookmark group "${group.title}" created`
    }
  }

  // ==================== Quick Command APIs ====================

  // Store.prototype.mcpListQuickCommands = function () {
  //   return deepCopy(window.store.quickCommands)
  // }

  // Store.prototype.mcpAddQuickCommand = function (args) {
  //   const { store } = window
  //   const qm = {
  //     id: uid(),
  //     name: args.name,
  //     commands: args.commands,
  //     inputOnly: args.inputOnly || false,
  //     labels: args.labels || []
  //   }

  //   store.addQuickCommand(qm)

  //   return {
  //     success: true,
  //     id: qm.id,
  //     message: `Quick command "${qm.name}" created`
  //   }
  // }

  // Store.prototype.mcpRunQuickCommand = function (args) {
  //   const { store } = window
  //   const qm = store.quickCommands.find(q => q.id === args.id)
  //   if (!qm) {
  //     throw new Error(`Quick command not found: ${args.id}`)
  //   }

  //   store.runQuickCommandItem(args.id)

  //   return {
  //     success: true,
  //     message: `Executed quick command "${qm.name}"`
  //   }
  // }

  // Store.prototype.mcpDeleteQuickCommand = function (args) {
  //   const { store } = window
  //   const qm = store.quickCommands.find(q => q.id === args.id)
  //   if (!qm) {
  //     throw new Error(`Quick command not found: ${args.id}`)
  //   }

  //   store.delQuickCommand({ id: args.id })

  //   return {
  //     success: true,
  //     message: `Deleted quick command "${qm.name}"`
  //   }
  // }

  // ==================== Tab APIs ====================

  Store.prototype.mcpListTabs = function () {
    const { store } = window
    return store.tabs.map(t => {
      return {
        id: t.id,
        title: t.title,
        host: t.host,
        type: t.type || 'local',
        status: t.status,
        isTransporting: t.isTransporting,
        onData: refsTabs.get('tab-' + t.id)?.state.terminalOnData,
        batch: t.batch
      }
    })
  }

  Store.prototype.mcpGetActiveTab = function () {
    const { store } = window
    const tab = store.currentTab
    if (!tab) {
      return { activeTabId: null, tab: null }
    }
    return {
      activeTabId: store.activeTabId,
      tab: {
        id: tab.id,
        title: tab.title,
        host: tab.host,
        type: tab.type || 'local',
        status: tab.status
      }
    }
  }

  Store.prototype.mcpSwitchTab = function (args) {
    const { store } = window
    const tab = store.tabs.find(t => t.id === args.tabId)
    if (!tab) {
      throw new Error(`Tab not found: ${args.tabId}`)
    }

    store.activeTabId = args.tabId
    if (tab.batch !== undefined) {
      store[`activeTabId${tab.batch}`] = args.tabId
    }

    return {
      success: true,
      message: `Switched to tab "${tab.title}"`
    }
  }

  Store.prototype.mcpCloseTab = function (args) {
    const { store } = window
    const tab = store.tabs.find(t => t.id === args.tabId)
    if (!tab) {
      throw new Error(`Tab not found: ${args.tabId}`)
    }

    store.delTab(args.tabId)

    return {
      success: true,
      message: `Closed tab "${tab.title}"`
    }
  }

  Store.prototype.mcpReloadTab = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    const tab = store.tabs.find(t => t.id === tabId)
    if (!tab) {
      throw new Error(`Tab not found: ${tabId}`)
    }

    store.reloadTab(tabId)

    return {
      success: true,
      message: `Reloaded tab "${tab.title}"`
    }
  }

  Store.prototype.mcpDuplicateTab = function (args) {
    const { store } = window
    const tab = store.tabs.find(t => t.id === args.tabId)
    if (!tab) {
      throw new Error(`Tab not found: ${args.tabId}`)
    }

    store.duplicateTab(args.tabId)

    return {
      success: true,
      message: `Duplicated tab "${tab.title}"`
    }
  }

  Store.prototype.mcpOpenLocalTerminal = function () {
    const { store } = window
    store.addTab()
    const newTabId = store.activeTabId

    return {
      success: true,
      tabId: newTabId,
      message: 'Opened new local terminal'
    }
  }

  Store.prototype.mcpOpenTab = function (args) {
    const { store } = window
    const data = fixBookmarkData({ ...args })

    const { valid, errors } = validateBookmarkData(data)
    if (!valid) {
      throw new Error(errors.join(', '))
    }

    const tab = {
      ...data,
      from: 'mcp',
      ...newTerm(true, true)
    }

    store.addTab(tab)
    const newTabId = store.activeTabId

    return {
      success: true,
      tabId: newTabId,
      type: data.type,
      message: `Opened ${data.type || 'local'} tab`
    }
  }

  // ==================== Terminal APIs ====================

  Store.prototype.mcpSendTerminalCommand = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    const command = args.command

    if (!tabId) {
      throw new Error('No active terminal')
    }

    if (command === undefined || command === null) {
      throw new Error('No command provided')
    }

    store.runQuickCommand(command, args.inputOnly || false, tabId)

    return {
      success: true,
      message: 'Command sent to terminal'
    }
  }

  Store.prototype.mcpGetTerminalSelection = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId

    if (!tabId) {
      throw new Error('No active terminal')
    }

    const term = refs.get('term-' + tabId)
    if (!term || !term.term) {
      throw new Error('Terminal not found')
    }

    const selection = term.term.getSelection()

    return {
      selection: selection || '',
      tabId
    }
  }

  Store.prototype.mcpGetTerminalOutput = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    const lineCount = args.lines || 50

    if (!tabId) {
      throw new Error('No active terminal')
    }

    const term = refs.get('term-' + tabId)
    if (!term || !term.term) {
      throw new Error('Terminal not found')
    }

    const buffer = term.term.buffer.active
    if (!buffer) {
      throw new Error('Terminal buffer not available')
    }

    const cursorY = buffer.cursorY || 0
    const baseY = buffer.baseY || 0
    const totalLines = buffer.length || 0

    // Calculate the actual content range
    // baseY is the scroll offset, cursorY is cursor position in viewport
    const actualContentEnd = baseY + cursorY + 1
    const startLine = Math.max(0, actualContentEnd - lineCount)
    const endLine = Math.min(totalLines, actualContentEnd)
    const lines = []

    for (let i = startLine; i < endLine; i++) {
      const line = buffer.getLine(i)
      if (line) {
        const text = line.translateToString(true)
        lines.push(text)
      }
    }

    return {
      output: lines.join('\n'),
      lineCount: lines.length,
      cursorY,
      baseY,
      tabId
    }
  }

  Store.prototype.mcpWaitForTerminalIdle = async function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    const timeout = Math.min(args.timeout || 30000, 120000)
    const pollInterval = 500
    const minWait = args.minWait !== undefined ? args.minWait : 1000
    const lineCountToFetch = args.lines || 50

    if (!tabId) {
      throw new Error('No active terminal')
    }

    const start = Date.now()

    // Brief initial wait so the command has time to start producing output
    if (minWait > 0) {
      await new Promise(resolve => setTimeout(resolve, minWait))
    }

    const collectOutput = () => {
      const term = refs.get('term-' + tabId)
      if (!term || !term.term) return { output: '', lineCount: 0 }
      const buffer = term.term.buffer.active
      if (!buffer) return { output: '', lineCount: 0 }
      const cursorY = buffer.cursorY || 0
      const baseY = buffer.baseY || 0
      const totalLines = buffer.length || 0
      const actualContentEnd = baseY + cursorY + 1
      const startLine = Math.max(0, actualContentEnd - lineCountToFetch)
      const endLine = Math.min(totalLines, actualContentEnd)
      const lines = []
      for (let i = startLine; i < endLine; i++) {
        const line = buffer.getLine(i)
        if (line) lines.push(line.translateToString(true))
      }
      return { output: lines.join('\n'), lineCount: lines.length }
    }

    // Poll until onData becomes false (4s idle debounce in tab.jsx)
    while (Date.now() - start < timeout) {
      const tabRef = refsTabs.get('tab-' + tabId)
      const onData = tabRef?.state.terminalOnData
      if (!onData) {
        const { output, lineCount } = collectOutput()
        return {
          tabId,
          elapsed: Date.now() - start,
          timedOut: false,
          output,
          lineCount
        }
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    // Timeout reached — return whatever is currently in the buffer
    const { output, lineCount } = collectOutput()
    return {
      tabId,
      elapsed: Date.now() - start,
      timedOut: true,
      message: `Terminal still active after ${timeout}ms`,
      output,
      lineCount
    }
  }

  // ==================== Terminal Status & Cancel ====================

  Store.prototype.mcpGetTerminalStatus = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    if (!tabId) {
      throw new Error('No active terminal')
    }

    const tabRef = refsTabs.get('tab-' + tabId)
    const onData = tabRef?.state.terminalOnData || ''
    const term = refs.get('term-' + tabId)

    let output = ''
    let lineCount = 0
    if (term && term.term) {
      const buffer = term.term.buffer.active
      if (buffer) {
        const lines = []
        const cursorY = buffer.cursorY || 0
        const baseY = buffer.baseY || 0
        const totalLines = buffer.length || 0
        const end = baseY + cursorY + 1
        const start = Math.max(0, end - 20)
        for (let i = start; i < Math.min(totalLines, end); i++) {
          const line = buffer.getLine(i)
          if (line) {
            lines.push(line.translateToString(true))
          }
        }
        output = lines.join('\n')
        lineCount = lines.length
      }
    }

    return {
      tabId,
      isRunning: onData === 'feed',
      hasPasswordPrompt: onData === 'password',
      isIdle: !onData,
      output,
      lineCount
    }
  }

  Store.prototype.mcpCancelTerminalCommand = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    if (!tabId) {
      throw new Error('No active terminal')
    }

    const term = refs.get('term-' + tabId)
    if (!term || !term.attachAddon) {
      throw new Error('Terminal not found')
    }

    term.attachAddon._sendData('\x03')
    return {
      success: true,
      message: 'Sent Ctrl+C to terminal',
      tabId
    }
  }

  // ==================== Background Task Management ====================

  const backgroundTasks = new Map()
  let bgTaskCounter = 0

  async function runMonitorCmd (tabId, cmd) {
    try {
      const result = await runCmd(tabId, cmd)
      return result
    } catch (e) {
      // Fallback: send via terminal and wait for idle
      const { store } = window
      store.mcpSendTerminalCommand({ command: cmd, tabId })
      const idle = await store.mcpWaitForTerminalIdle({
        tabId, timeout: 10000, lines: 10, minWait: 500
      })
      return idle.output || ''
    }
  }

  Store.prototype.mcpRunBackgroundCommand = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    if (!tabId) {
      throw new Error('No active terminal')
    }
    if (!args.command) {
      throw new Error('No command provided')
    }

    const taskId = `bg-${Date.now()}-${++bgTaskCounter}`
    const logFile = `/tmp/electerm-${taskId}.log`
    const pidFile = `/tmp/electerm-${taskId}.pid`
    const exitFile = `/tmp/electerm-${taskId}.exit`

    // Encode command as base64 to avoid all quote-escaping issues.
    // The subshell runs the user's command, captures its exit code, then cleans up the PID file.
    const b64 = btoa(args.command)
    const inner = `eval "$(echo ${b64} | base64 --decode)" > ${logFile} 2>&1; e=$?; echo $e > ${exitFile}; rm -f ${pidFile}`
    const wrapped = `nohup bash -c '${inner}' & echo $! > ${pidFile}; disown`

    store.mcpSendTerminalCommand({ command: wrapped, tabId, inputOnly: false })

    const task = {
      id: taskId,
      command: args.command,
      tabId,
      startTime: Date.now(),
      logFile,
      pidFile,
      exitFile,
      status: 'started'
    }
    backgroundTasks.set(taskId, task)

    return {
      taskId,
      tabId,
      logFile,
      pidFile,
      exitFile,
      message: 'Command started in background. Use get_background_task_status to check.'
    }
  }

  Store.prototype.mcpGetBackgroundTaskStatus = async function (args) {
    const task = backgroundTasks.get(args.taskId)
    if (!task) {
      throw new Error(`Task ${args.taskId} not found`)
    }

    const pidOutput = await runMonitorCmd(task.tabId,
      `cat ${task.pidFile} 2>/dev/null`)
    const pid = pidOutput.trim()

    if (!pid) {
      return { ...task, status: 'unknown', message: 'PID file not found' }
    }

    const aliveCheck = await runMonitorCmd(task.tabId,
      `kill -0 ${pid} 2>/dev/null && echo alive || echo dead`)

    if (aliveCheck.trim() === 'alive') {
      task.status = 'running'
      return { ...task, pid, status: 'running' }
    }

    // Process exited — read exit code
    const exitOutput = await runMonitorCmd(task.tabId,
      `cat ${task.exitFile} 2>/dev/null`)
    const exitCode = exitOutput.trim()

    task.status = 'completed'
    task.exitCode = exitCode !== '' ? parseInt(exitCode, 10) : null
    task.endTime = Date.now()
    return { ...task, pid, status: 'completed', exitCode: task.exitCode }
  }

  Store.prototype.mcpGetBackgroundTaskLog = async function (args) {
    const task = backgroundTasks.get(args.taskId)
    if (!task) {
      throw new Error(`Task ${args.taskId} not found`)
    }

    const lines = args.lines || 100
    const output = await runMonitorCmd(task.tabId,
      `tail -n ${lines} ${task.logFile} 2>/dev/null || echo '(no output yet)'`)

    return {
      taskId: task.id,
      output: output.trim(),
      lines
    }
  }

  Store.prototype.mcpCancelBackgroundTask = async function (args) {
    const task = backgroundTasks.get(args.taskId)
    if (!task) {
      throw new Error(`Task ${args.taskId} not found`)
    }

    const pidOutput = await runMonitorCmd(task.tabId,
      `cat ${task.pidFile} 2>/dev/null`)
    const pid = pidOutput.trim()

    if (pid) {
      await runMonitorCmd(task.tabId,
        `kill ${pid} 2>/dev/null; echo $? > ${task.exitFile}`)
      task.status = 'cancelled'
      task.endTime = Date.now()
      return {
        taskId: task.id,
        pid,
        status: 'cancelled',
        message: 'Process killed'
      }
    }

    return {
      taskId: task.id,
      status: 'unknown',
      message: 'PID not found, task may have already finished'
    }
  }

  // ==================== Settings APIs ====================

  Store.prototype.mcpGetSettings = function () {
    const { store } = window
    // Return safe settings (no sensitive data)
    const config = store.config
    const excludeKeys = ['apiKeyAI', 'syncSetting']
    const safeConfig = Object.fromEntries(
      Object.entries(config).filter(([key]) => !excludeKeys.includes(key))
    )
    return safeConfig
  }

  // ==================== SFTP APIs ====================

  Store.prototype.mcpGetSshSftpRef = function (tabId) {
    const { store } = window
    const resolvedTabId = tabId || store.activeTabId
    if (!resolvedTabId) {
      throw new Error('No active tab')
    }
    const tab = store.tabs.find(t => t.id === resolvedTabId)
    if (!tab) {
      throw new Error(`Tab not found: ${resolvedTabId}`)
    }
    if (tab.type !== 'ssh' && tab.type !== 'ftp') {
      throw new Error(`Tab "${resolvedTabId}" is not an SSH/SFTP tab (type: ${tab.type || 'local'})`)
    }
    const sftpEntry = refs.get('sftp-' + resolvedTabId)
    if (!sftpEntry || !sftpEntry.sftp) {
      throw new Error(`SFTP not initialized for tab "${resolvedTabId}". Open the SFTP panel first.`)
    }
    return { sftp: sftpEntry.sftp, tab, tabId: resolvedTabId }
  }

  Store.prototype.mcpSftpList = async function (args) {
    const { sftp, tab, tabId } = window.store.mcpGetSshSftpRef(args.tabId)
    const remotePath = args.remotePath
    if (!remotePath) {
      throw new Error('remotePath is required')
    }
    const list = await sftp.list(remotePath)
    return { tabId, host: tab.host, path: remotePath, list }
  }

  Store.prototype.mcpSftpStat = async function (args) {
    const { sftp, tab, tabId } = window.store.mcpGetSshSftpRef(args.tabId)
    const remotePath = args.remotePath
    if (!remotePath) {
      throw new Error('remotePath is required')
    }
    const stat = await sftp.stat(remotePath)
    return { tabId, host: tab.host, path: remotePath, stat }
  }

  Store.prototype.mcpSftpReadFile = async function (args) {
    const { sftp, tab, tabId } = window.store.mcpGetSshSftpRef(args.tabId)
    const remotePath = args.remotePath
    if (!remotePath) {
      throw new Error('remotePath is required')
    }
    const content = await sftp.readFile(remotePath)
    return { tabId, host: tab.host, path: remotePath, content }
  }

  Store.prototype.mcpSftpDel = async function (args) {
    const { sftp, tab, tabId } = window.store.mcpGetSshSftpRef(args.tabId)
    const remotePath = args.remotePath
    if (!remotePath) {
      throw new Error('remotePath is required')
    }
    // Use stat to determine if it's a file or directory
    const stat = await sftp.stat(remotePath)
    const isDirectory = typeof stat.isDirectory === 'function'
      ? stat.isDirectory()
      : !!stat.isDirectory
    if (isDirectory) {
      await sftp.rmdir(remotePath)
    } else {
      await sftp.rm(remotePath)
    }
    return { success: true, tabId, host: tab.host, path: remotePath, type: isDirectory ? 'directory' : 'file' }
  }

  // ==================== File Transfer APIs ====================

  Store.prototype.mcpSftpUpload = async function (args) {
    const { store } = window
    const { tab, tabId } = store.mcpGetSshSftpRef(args.tabId)
    const localPath = args.localPath
    const remotePath = args.remotePath
    if (!localPath) {
      throw new Error('localPath is required')
    }
    if (!remotePath) {
      throw new Error('remotePath is required')
    }

    window._transferConflictPolicy = args.conflictPolicy || 'mergeOrOverwriteAll'

    const fromFile = await getLocalFileInfo(localPath)
    const transferItem = {
      host: tab.host,
      tabType: tab.type || 'ssh',
      typeFrom: 'local',
      typeTo: 'remote',
      fromPath: localPath,
      toPath: remotePath,
      fromFile: {
        ...fromFile,
        host: tab.host,
        tabType: tab.type || 'ssh',
        tabId,
        title: tab.title
      },
      id: uid(),
      title: tab.title,
      tabId,
      operation: ''
    }

    store.addTransferList([transferItem])

    return {
      success: true,
      message: `Upload started: ${localPath} → ${tab.host}:${remotePath}`,
      transferId: transferItem.id,
      tabId
    }
  }

  Store.prototype.mcpSftpDownload = async function (args) {
    const { store } = window
    const { sftp, tab, tabId } = store.mcpGetSshSftpRef(args.tabId) // sftp used for getRemoteFileInfo
    const remotePath = args.remotePath
    const localPath = args.localPath
    if (!remotePath) {
      throw new Error('remotePath is required')
    }
    if (!localPath) {
      throw new Error('localPath is required')
    }

    window._transferConflictPolicy = args.conflictPolicy || 'mergeOrOverwriteAll'

    const fromFile = await getRemoteFileInfo(sftp, remotePath)
    const transferItem = {
      host: tab.host,
      tabType: tab.type || 'ssh',
      typeFrom: 'remote',
      typeTo: 'local',
      fromPath: remotePath,
      toPath: localPath,
      fromFile: {
        ...fromFile,
        id: uid(),
        isSymbolicLink: false
      },
      id: uid(),
      title: tab.title,
      tabId
    }

    store.addTransferList([transferItem])

    return {
      success: true,
      message: `Download started: ${tab.host}:${remotePath} → ${localPath}`,
      transferId: transferItem.id,
      tabId
    }
  }

  // ==================== Transfer List/History APIs ====================

  Store.prototype.mcpSftpTransferList = function () {
    return deepCopy(window.store.fileTransfers)
  }

  Store.prototype.mcpSftpTransferHistory = function () {
    return deepCopy(window.store.transferHistory)
  }

  // ==================== Zmodem (trzsz/rzsz) APIs ====================

  Store.prototype.mcpZmodemUpload = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    if (!tabId) {
      throw new Error('No active tab')
    }
    const tab = store.tabs.find(t => t.id === tabId)
    if (!tab) {
      throw new Error(`Tab not found: ${tabId}`)
    }

    const files = args.files
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('files array is required (list of local file paths to upload)')
    }

    const protocol = args.protocol || 'rzsz'
    const uploadCmd = protocol === 'trzsz' ? 'trz' : 'rz'

    // Set the control variable to bypass native file dialog
    window._apiControlSelectFile = files

    const term = refs.get('term-' + tabId)
    if (!term) {
      throw new Error(`Terminal not found for tab: ${tabId}`)
    }
    term.runQuickCommand(uploadCmd)

    return {
      success: true,
      protocol,
      command: uploadCmd,
      message: `${uploadCmd} upload initiated for ${files.length} file(s)`,
      files,
      tabId
    }
  }

  Store.prototype.mcpZmodemDownload = function (args) {
    const { store } = window
    const tabId = args.tabId || store.activeTabId
    if (!tabId) {
      throw new Error('No active tab')
    }
    const tab = store.tabs.find(t => t.id === tabId)
    if (!tab) {
      throw new Error(`Tab not found: ${tabId}`)
    }

    const saveFolder = args.saveFolder
    if (!saveFolder) {
      throw new Error('saveFolder is required (local folder to save downloaded files)')
    }

    const remoteFiles = args.remoteFiles
    if (!remoteFiles || !Array.isArray(remoteFiles) || remoteFiles.length === 0) {
      throw new Error('remoteFiles array is required (list of remote file paths to download)')
    }

    const protocol = args.protocol || 'rzsz'
    const downloadCmd = protocol === 'trzsz' ? 'tsz' : 'sz'

    // Set the control variable to bypass native folder dialog
    window._apiControlSelectFolder = saveFolder

    const term = refs.get('term-' + tabId)
    if (!term) {
      throw new Error(`Terminal not found for tab: ${tabId}`)
    }
    const quotedFiles = remoteFiles.map(f => `"${f}"`).join(' ')
    term.runQuickCommand(`${downloadCmd} ${quotedFiles}`)

    return {
      success: true,
      protocol,
      command: downloadCmd,
      message: `${downloadCmd} download initiated for ${remoteFiles.length} file(s) to ${saveFolder}`,
      remoteFiles,
      saveFolder,
      tabId
    }
  }
}

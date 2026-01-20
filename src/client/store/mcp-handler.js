/**
 * MCP (Model Context Protocol) handler for store
 * Handles IPC requests from the MCP server widget
 */

import uid from '../common/uid'
import { settingMap } from '../common/constants'
import { refs } from '../components/common/ref'

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

        // Quick command operations
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

        // History operations
        case 'list_history':
          result = store.mcpListHistory(args)
          break
        case 'clear_history':
          result = store.mcpClearHistory()
          break

        // Transfer operations
        case 'list_transfers':
          result = store.mcpListTransfers()
          break
        case 'list_transfer_history':
          result = store.mcpListTransferHistory(args)
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

  Store.prototype.mcpListBookmarks = function (args = {}) {
    const { store } = window
    let bookmarks = store.bookmarks

    if (args.groupId) {
      const group = store.bookmarkGroups.find(g => g.id === args.groupId)
      if (group && group.bookmarkIds) {
        const idSet = new Set(group.bookmarkIds)
        bookmarks = bookmarks.filter(b => idSet.has(b.id))
      }
    }

    return bookmarks.map(b => ({
      id: b.id,
      title: b.title,
      host: b.host,
      port: b.port,
      username: b.username,
      type: b.type || 'ssh',
      color: b.color
    }))
  }

  Store.prototype.mcpGetBookmark = function (args) {
    const { store } = window
    const bookmark = store.bookmarks.find(b => b.id === args.id)
    if (!bookmark) {
      throw new Error(`Bookmark not found: ${args.id}`)
    }
    // Return bookmark without sensitive data
    const { password, passphrase, privateKey, ...safeBookmark } = bookmark
    return safeBookmark
  }

  Store.prototype.mcpAddBookmark = async function (args) {
    const { store } = window
    const bookmark = {
      id: uid(),
      title: args.title,
      host: args.host || '',
      port: args.port || 22,
      username: args.username || '',
      password: args.password || '',
      type: args.type || 'local',
      term: 'xterm-256color',
      ...args
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
    const bookmark = store.bookmarks.find(b => b.id === args.id)
    if (!bookmark) {
      throw new Error(`Bookmark not found: ${args.id}`)
    }

    store.delItem({ id: args.id }, settingMap.bookmarks)

    return {
      success: true,
      message: `Bookmark "${bookmark.title}" deleted`
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
    const { store } = window
    return store.bookmarkGroups.map(g => ({
      id: g.id,
      title: g.title,
      level: g.level,
      bookmarkCount: (g.bookmarkIds || []).length,
      subgroupCount: (g.bookmarkGroupIds || []).length
    }))
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

  Store.prototype.mcpListQuickCommands = function () {
    const { store } = window
    return store.quickCommands.map(q => ({
      id: q.id,
      name: q.name,
      command: q.command,
      commands: q.commands,
      inputOnly: q.inputOnly,
      labels: q.labels
    }))
  }

  Store.prototype.mcpAddQuickCommand = function (args) {
    const { store } = window
    const qm = {
      id: uid(),
      name: args.name,
      command: args.command,
      inputOnly: args.inputOnly || false,
      labels: args.labels || []
    }

    store.addQuickCommand(qm)

    return {
      success: true,
      id: qm.id,
      message: `Quick command "${qm.name}" created`
    }
  }

  Store.prototype.mcpRunQuickCommand = function (args) {
    const { store } = window
    const qm = store.quickCommands.find(q => q.id === args.id)
    if (!qm) {
      throw new Error(`Quick command not found: ${args.id}`)
    }

    store.runQuickCommandItem(args.id)

    return {
      success: true,
      message: `Executed quick command "${qm.name}"`
    }
  }

  Store.prototype.mcpDeleteQuickCommand = function (args) {
    const { store } = window
    const qm = store.quickCommands.find(q => q.id === args.id)
    if (!qm) {
      throw new Error(`Quick command not found: ${args.id}`)
    }

    store.delQuickCommand({ id: args.id })

    return {
      success: true,
      message: `Deleted quick command "${qm.name}"`
    }
  }

  // ==================== Tab APIs ====================

  Store.prototype.mcpListTabs = function () {
    const { store } = window
    return store.tabs.map(t => ({
      id: t.id,
      title: t.title,
      host: t.host,
      type: t.type || 'local',
      status: t.status,
      isTransporting: t.isTransporting,
      batch: t.batch
    }))
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

    store.runQuickCommand(command, args.inputOnly || false)

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

  // ==================== History APIs ====================

  Store.prototype.mcpListHistory = function (args = {}) {
    const { store } = window
    const limit = args.limit || 50
    const history = store.history.slice(0, limit)

    return history.map(h => ({
      id: h.id,
      title: h.title,
      host: h.host,
      type: h.type,
      time: h.time
    }))
  }

  Store.prototype.mcpClearHistory = function () {
    const { store } = window
    store.history = []

    return {
      success: true,
      message: 'History cleared'
    }
  }

  // ==================== Transfer APIs ====================

  Store.prototype.mcpListTransfers = function () {
    const { store } = window
    return store.fileTransfers.map(t => ({
      id: t.id,
      localPath: t.localPath,
      remotePath: t.remotePath,
      type: t.type,
      percent: t.percent,
      status: t.status
    }))
  }

  Store.prototype.mcpListTransferHistory = function (args = {}) {
    const { store } = window
    const limit = args.limit || 50
    return store.transferHistory.slice(0, limit).map(t => ({
      id: t.id,
      localPath: t.localPath,
      remotePath: t.remotePath,
      type: t.type,
      status: t.status,
      time: t.time
    }))
  }

  // ==================== Settings APIs ====================

  Store.prototype.mcpGetSettings = function () {
    const { store } = window
    // Return safe settings (no sensitive data)
    const config = store.config
    const safeConfig = {
      theme: config.theme,
      language: config.language,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      terminalType: config.terminalType,
      cursorStyle: config.cursorStyle,
      cursorBlink: config.cursorBlink,
      scrollback: config.scrollback
    }
    return safeConfig
  }

  Store.prototype.mcpListTerminalThemes = function () {
    const { store } = window
    return store.terminalThemes.map(t => ({
      id: t.id,
      name: t.name,
      themeLight: t.themeLight
    }))
  }

  Store.prototype.mcpListUiThemes = function () {
    const { store } = window
    return (store.uiThemes || []).map(t => ({
      id: t.id,
      name: t.name
    }))
  }
}

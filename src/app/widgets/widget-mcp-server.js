/**
 * MCP Server Widget
 * Exposes electerm store APIs via Model Context Protocol
 * Runs in main process and uses IPC to communicate with frontend
 * Uses a simple local MCP implementation
 */

const crypto = require('crypto')
const { ipcMain } = require('electron')
const { McpServer } = require('../mcp/server/mcp.js')
const { StreamableHTTPServerTransport } = require('../mcp/server/streamableHttp.js')
const { TaskManager } = require('../mcp/server/tasks.js')
const { z } = require('../lib/zod')
const express = require('express')
const uid = require('../common/uid')
const globalState = require('../lib/glob-state')
const {
  sshBookmarkSchema,
  telnetBookmarkSchema,
  serialBookmarkSchema,
  localBookmarkSchema
} = require('../common/bookmark-zod-schemas')

// Dangerous tab props that allow arbitrary command execution.
// Must be stripped from any MCP tool args before forwarding to the renderer.
// Shared with src/client/store/tab.js and the quick connect parser so the
// copies cannot drift apart.
const dangerousTabProps = require('../common/dangerous-session-fields')

function stripDangerousTabProps (obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !dangerousTabProps.includes(key))
  )
}

// Tab UI-state props that must never cross the MCP boundary.
// A crafted `batch` used to crash the renderer (sizes[batch] undefined).
// The renderer assigns batch from the current layout instead.
const tabInternalProps = [
  'batch',
  'id',
  'status',
  'pane',
  'tabCount',
  'from',
  'srcId',
  'sftpCreated',
  'isTransporting',
  'mcpStatus',
  'keepaliveEnabled',
  'activeTabId',
  'sshSftpSplitView',
  'sshTunnelResults',
  'displayRaw',
  'autoReConnect',
  '_reloadState',
  'isPinned'
]

function stripTabInternalProps (obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !tabInternalProps.includes(key))
  )
}

function sanitizeTabArgs (args) {
  return stripTabInternalProps(stripDangerousTabProps({ ...(args || {}) }))
}

const widgetInfo = {
  name: 'MCP Server',
  description: 'Expose electerm APIs via Model Context Protocol (MCP) for AI assistants and external tools.',
  version: '1.0.0',
  author: 'ZHAO Xudong',
  type: 'instance',
  builtin: true,
  singleInstance: true,
  configs: [
    {
      name: 'host',
      type: 'string',
      default: '127.0.0.1',
      description: 'The IP address to bind the MCP server to'
    },
    {
      name: 'port',
      type: 'number',
      default: 30837,
      description: 'The port number to listen on'
    },
    {
      name: 'apiKey',
      type: 'string',
      default: '',
      showGenerator: true,
      description: 'API key for authenticating MCP requests. Generated and remembered on first start; leave empty to keep using the saved one, or fill in your own to replace it. The server URL already carries it, so a client can be configured by pasting the copied URL.'
    },
    {
      name: 'enableBookmarks',
      type: 'boolean',
      default: true,
      description: 'Enable bookmark APIs (list, get, add, edit, delete)'
    },
    {
      name: 'bookmarkKeyword',
      type: 'string',
      default: '',
      description: 'Filter keyword for bookmark list API. Only bookmarks with titles containing this keyword (case-insensitive) will be returned. Leave empty to return all bookmarks.'
    },
    {
      name: 'enableBookmarkGroups',
      type: 'boolean',
      default: true,
      description: 'Enable bookmark group APIs'
    },

    {
      name: 'enableSftp',
      type: 'boolean',
      default: true,
      description: 'Enable read-only SFTP APIs (list, stat, read, transfer list/history)'
    },
    {
      name: 'enableSftpWrite',
      type: 'boolean',
      default: false,
      description: 'Enable SFTP write APIs (upload, download, delete, trzsz transfer). Off by default: these move files between the remote server and this machine, so an MCP client or an AI steered by injected content could otherwise read and write local files.'
    },
    {
      name: 'autoConfirmTransfers',
      type: 'boolean',
      default: false,
      description: 'Let MCP-initiated transfers overwrite existing files without the transfer conflict dialog. Off by default. Paths that grant code execution (shell rc, ssh trust store, autostart) still require approval.'
    },
    {
      name: 'enableSettings',
      type: 'boolean',
      default: false,
      description: 'Enable settings APIs'
    },
    {
      name: 'autoRun',
      type: 'boolean',
      default: false,
      description: 'Automatically start this MCP server when the app launches'
    },
    {
      name: 'commandBlacklist',
      type: 'textarea',
      default: '',
      description: 'Newline-separated list of regex patterns. Commands matching any pattern are rejected. Built-in dangerous patterns are always active.'
    },
    {
      name: 'commandWhitelist',
      type: 'textarea',
      default: '',
      description: 'Newline-separated list of regex patterns. When non-empty, only commands matching at least one pattern are allowed (whitelist mode).'
    },
    {
      name: 'execTimeoutMs',
      type: 'number',
      default: 120000,
      description: 'Default timeout (ms) for execute_electerm_command. Commands exceeding it return partial output with timedOut=true.'
    },
    {
      name: 'execMaxOutputBytes',
      type: 'number',
      default: 204800,
      description: 'Max characters of stdout/stderr returned by execute_electerm_command. Longer output is tail-truncated with truncated=true.'
    },
    {
      name: 'enableTasks',
      type: 'boolean',
      default: true,
      description: 'Enable the MCP Tasks extension (io.modelcontextprotocol/tasks, SEP-2663). Lets supporting clients run long commands as pollable tasks via execute_electerm_command with wait=false.'
    },
    {
      name: 'taskTtlMs',
      type: 'number',
      default: 3600000,
      description: 'How long (ms) a finished MCP task is retained for tasks/get before being swept. Also triggers remote temp-file cleanup.'
    }
  ]
}

function getDefaultConfig () {
  return widgetInfo.configs.reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})
}

// Host header values accepted for a given bind address. A loopback bind also
// accepts the other loopback spellings, because a client may reach the server
// as 127.0.0.1, localhost or [::1] regardless of which one we bound to.
const WILDCARD_BINDS = ['', '0.0.0.0', '::', '[::]']

function isWildcardBind (host) {
  return WILDCARD_BINDS.includes(host)
}

function loopbackAliases (host) {
  const bare = host.replace(/^\[(.*)\]$/, '$1')
  if (bare !== '127.0.0.1' && bare !== 'localhost' && bare !== '::1') {
    return []
  }
  return ['127.0.0.1', 'localhost', '::1', '[::1]']
}

function buildAllowedHosts (host, port) {
  const out = new Set()
  for (const h of [host, ...loopbackAliases(host)]) {
    out.add(h)
    out.add(`${h}:${port}`)
  }
  return out
}

// Constant-time compare, and length-safe: timingSafeEqual throws on a length
// mismatch, which would turn a wrong guess into a 500 instead of a 401.
function apiKeyMatches (provided, expected) {
  const a = Buffer.from(String(provided || ''))
  const b = Buffer.from(String(expected || ''))
  if (!a.length || a.length !== b.length) {
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

class ElectermMCPServer {
  constructor (config, ctx = {}) {
    this.config = config
    // instance log/event channels, see widgets/instance-log.js — optional so the
    // server still works when constructed without one (tests)
    this.ctx = ctx
    // The renderer generates and remembers the key (common/widget-api-key.js)
    // and passes it in; this is the last line of defence, so that no code path
    // — a stale config, a caller that forgot — can start the server with
    // authentication off and hand a DNS-rebound page a shell.
    if (!this.config.apiKey) {
      this.config.apiKey = 'ett_' + crypto.randomBytes(16).toString('hex')
    }
    this.instanceId = uid()
    this.httpServer = null
    this.mcpServer = null
    this.ipcHandler = null
    this.pendingRequests = new Map()
    this.transports = {}
    this.taskManager = null
  }

  logLine (level, ...args) {
    if (typeof this.ctx.log === 'function') {
      this.ctx.log(level, ...args)
    }
  }

  reportEvent (event) {
    if (typeof this.ctx.event === 'function') {
      this.ctx.event(event)
    }
  }

  // Built-in blacklist: patterns that are always blocked regardless of user config.
  // These cover the most common destructive / privilege-escalation shell idioms.
  static get BUILTIN_BLACKLIST () {
    return [
      /rm\s+-[^\s]*[rR][^\s]*\s+\//, // rm -rf / or rm -Rf / (recursive delete from root)
      /rm\s+-[^\s]*[rR][^\s]*\s+~/, // rm -rf ~ or rm -Rf ~ (recursive delete home)
      /rm\s+--recursive/, // rm --recursive (long-form flag)
      /:\s*\(\s*\)\s*\{.*\|.*:.*&.*\}\s*;.*:/, // fork bomb  :(){:|:&};:
      /\bdd\b.*\bof\s*=\s*\/dev\//, // dd of=/dev/...
      /\bmkfs\b/, // mkfs (format filesystem)
      />\s*\/dev\/[sh]d[a-z]/, // redirect to raw disk
      /\bsudo\s+rm\b/, // sudo rm
      /curl\s+.*\|\s*sh/, // curl | sh  (remote code execution)
      /wget\s+.*\|\s*sh/, // wget | sh
      /curl\s+.*\|\s*bash/, // curl | bash
      /wget\s+.*\|\s*bash/ // wget | bash
    ]
  }

  // The effective command rules, in the same shape validateCommand applies:
  // same trimming, same blank-line filtering, same "a non-empty whitelist puts
  // us in whitelist mode". get_electerm_command_rules returns this verbatim, so
  // the parsing lives in one place and what an agent reads cannot drift from
  // what is actually enforced.
  getCommandRules () {
    const parse = s => (s || '')
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean)
    const commandBlacklist = parse(this.config.commandBlacklist)
    const commandWhitelist = parse(this.config.commandWhitelist)
    return {
      mode: commandWhitelist.length > 0 ? 'whitelist' : 'blacklist',
      // Regex sources: applied with RegExp#test to the whole command string.
      builtinBlacklist: ElectermMCPServer.BUILTIN_BLACKLIST.map(r => r.source),
      commandBlacklist,
      commandWhitelist
    }
  }

  // Everything the renderer needs to screen a transfer before queueing it:
  // strict = whitelist mode (every transfer an MCP client starts is reviewed),
  // autoConfirm = the user opted out of the transfer conflict dialog.
  getTransferPolicy () {
    return {
      strict: this.getCommandRules().mode === 'whitelist',
      autoConfirm: !!this.config.autoConfirmTransfers
    }
  }

  // Every rejection names the read-only rules tool, so an agent that guessed
  // wrong learns the boundary from the error instead of bisecting it by trial
  // and error — in whitelist mode a single miss says nothing about what is
  // allowed.
  static get RULES_HINT () {
    return 'Call get_electerm_command_rules to see the rules this instance enforces.'
  }

  // Validate a command against whitelist/blacklist rules.
  // Returns { allowed: true } or { allowed: false, reason: string }
  validateCommand (command) {
    const {
      commandBlacklist: userBlacklist,
      commandWhitelist: userWhitelist
    } = this.getCommandRules()

    // 1. Always-on built-in blacklist
    for (const pattern of ElectermMCPServer.BUILTIN_BLACKLIST) {
      if (pattern.test(command)) {
        return { allowed: false, reason: `Command blocked by built-in safety rule: ${pattern}. ${ElectermMCPServer.RULES_HINT}` }
      }
    }

    // 2. User-defined blacklist (regex strings)
    for (const raw of userBlacklist) {
      try {
        if (new RegExp(raw).test(command)) {
          return { allowed: false, reason: `Command blocked by blacklist pattern: ${raw}. ${ElectermMCPServer.RULES_HINT}` }
        }
      } catch (_) {
        // ignore invalid regex in config
      }
    }

    // 3. User-defined whitelist — only enforced when at least one pattern is
    //    configured (a non-empty list puts us in whitelist mode).
    if (userWhitelist.length > 0) {
      const allowed = userWhitelist.some(raw => {
        try {
          return new RegExp(raw).test(command)
        } catch (_) {
          return false
        }
      })
      if (!allowed) {
        return { allowed: false, reason: `Command not in whitelist. ${ElectermMCPServer.RULES_HINT}` }
      }
    }

    return { allowed: true }
  }

  // Send request to renderer process via IPC
  sendToRenderer (action, data, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const requestId = uid()
      const win = globalState.get('win')

      if (!win) {
        reject(new Error('No active window'))
        return
      }

      // Set up response handler
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Request timeout'))
      }, timeoutMs)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      // Send to renderer
      win.webContents.send('mcp-request', {
        requestId,
        action,
        data
      })
    })
  }

  // ==================== MCP Tasks lifecycle (SEP-2663) ====================
  // Tasks wrap the renderer's background-command engine (nohup + pid/exit/
  // log files). These methods map renderer background states onto the MCP
  // task state machine.

  // onGet hook: refresh a working task from the renderer before tasks/get
  // returns it. Terminal renderer states move the task to a terminal status.
  async refreshTask (task) {
    const { bgTaskId, startedAt } = task.meta || {}
    if (!bgTaskId) {
      return
    }
    try {
      const status = await this.sendToRenderer('tool-call', {
        toolName: 'get_background_task_status',
        args: { taskId: bgTaskId }
      })
      if (status.status === 'completed') {
        const log = await this.sendToRenderer('tool-call', {
          toolName: 'get_background_task_log',
          args: { taskId: bgTaskId, lines: 200 }
        })
        const maxOut = this.config.execMaxOutputBytes || 204800
        let stdout = log.output || ''
        let truncated = false
        if (stdout.length > maxOut) {
          stdout = stdout.slice(-maxOut)
          truncated = true
        }
        this.taskManager.complete(task.taskId, {
          stdout,
          stderr: '',
          stderrMerged: true,
          exitCode: typeof status.exitCode === 'number' ? status.exitCode : null,
          durationMs: (status.endTime || Date.now()) - (startedAt || Date.now()),
          truncated,
          mode: 'background',
          tabId: task.meta.tabId
        })
      } else if (status.status === 'cancelled') {
        this.taskManager.cancelLocal(task.taskId)
      } else if (status.status === 'unknown') {
        this.taskManager.fail(task.taskId, status.message || 'Background task state unknown')
      } else {
        // still running — surface elapsed time for polling clients
        const elapsed = Math.round((Date.now() - (startedAt || Date.now())) / 1000)
        task.statusMessage = `Running (${elapsed}s elapsed)`
      }
    } catch (e) {
      this.taskManager.fail(task.taskId, e.message)
    }
  }

  // onCancel hook: kill the underlying background process.
  async cancelTaskRemote (task) {
    const { bgTaskId } = task.meta || {}
    if (!bgTaskId) {
      return
    }
    try {
      await this.sendToRenderer('tool-call', {
        toolName: 'cancel_background_task',
        args: { taskId: bgTaskId }
      })
    } catch (_) {
      // best-effort kill — the task is marked cancelled regardless
    }
  }

  // onSweep hook: remove remote temp files (log/pid/exit) for swept tasks.
  async sweepTaskRemote (task) {
    const { bgTaskId } = task.meta || {}
    if (!bgTaskId) {
      return
    }
    try {
      await this.sendToRenderer('tool-call', {
        toolName: 'cleanup_background_task',
        args: { taskId: bgTaskId }
      }, 10000)
    } catch (_) {
      // best-effort cleanup
    }
  }

  // Register all tools on the MCP server
  registerTools () {
    const server = this.mcpServer
    const self = this

    // ==================== Tab/Terminal APIs (always enabled) ====================

    server.registerTool(
      'list_electerm_tabs',
      {
        description: 'List all open electerm terminal tabs',
        inputSchema: z.object({})
      },
      async () => {
        const result = await self.sendToRenderer('tool-call', { toolName: 'list_tabs', args: {} })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'get_electerm_active_tab',
      {
        description: 'Get the currently active electerm tab',
        inputSchema: z.object({})
      },
      async () => {
        const result = await self.sendToRenderer('tool-call', { toolName: 'get_active_tab', args: {} })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'switch_electerm_tab',
      {
        description: 'Switch to a specific electerm tab',
        inputSchema: {
          tabId: z.string().describe('Tab ID to switch to')
        }
      },
      async ({ tabId }) => {
        const result = await self.sendToRenderer('tool-call', { toolName: 'switch_tab', args: { tabId } })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'close_electerm_tab',
      {
        description: 'Close a specific electerm tab',
        inputSchema: {
          tabId: z.string().describe('Tab ID to close')
        }
      },
      async ({ tabId }) => {
        const result = await self.sendToRenderer('tool-call', { toolName: 'close_tab', args: { tabId } })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'reload_electerm_tab',
      {
        description: 'Reload/reconnect an electerm tab',
        inputSchema: {
          tabId: z.string().optional().describe('Tab ID to reload (default: active tab)')
        }
      },
      async (args) => {
        const tabId = args?.tabId
        const result = await self.sendToRenderer('tool-call', { toolName: 'reload_tab', args: { tabId } })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'duplicate_electerm_tab',
      {
        description: 'Duplicate an electerm tab',
        inputSchema: {
          tabId: z.string().describe('Tab ID to duplicate')
        }
      },
      async ({ tabId }) => {
        const result = await self.sendToRenderer('tool-call', { toolName: 'duplicate_tab', args: { tabId } })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'open_electerm_local_terminal',
      {
        description: 'Open a new electerm local terminal tab',
        inputSchema: z.object({})
      },
      async () => {
        const result = await self.sendToRenderer('tool-call', { toolName: 'open_local_terminal', args: {} })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'send_electerm_terminal_command',
      {
        description: 'Send a command to the active electerm terminal. For non-interactive commands, prefer execute_electerm_command — it returns structured stdout/stderr/exitCode in one call instead of requiring send + wait + read.',
        inputSchema: {
          command: z.string().describe('Command to send'),
          tabId: z.string().optional().describe('Optional: specific tab ID'),
          inputOnly: z.boolean().optional().describe('Input only mode (no enter key)')
        }
      },
      async ({ command, tabId, inputOnly }) => {
        const check = self.validateCommand(command)
        if (!check.allowed) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: check.reason }, null, 2) }], isError: true }
        }
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'send_terminal_command',
          args: { command, tabId, inputOnly }
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'get_electerm_terminal_selection',
      {
        description: 'Get the current text selection in electerm terminal',
        inputSchema: {
          tabId: z.string().optional().describe('Optional: specific tab ID')
        }
      },
      async (args) => {
        const tabId = args?.tabId
        const result = await self.sendToRenderer('tool-call', { toolName: 'get_terminal_selection', args: { tabId } })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'get_electerm_terminal_output',
      {
        description: 'Get recent electerm terminal output/buffer content',
        inputSchema: {
          tabId: z.string().optional().describe('Optional: specific tab ID'),
          lines: z.number().optional().describe('Number of lines to return (default: 50)')
        }
      },
      async (args) => {
        const tabId = args?.tabId
        const lines = args?.lines
        const result = await self.sendToRenderer('tool-call', { toolName: 'get_terminal_output', args: { tabId, lines } })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'wait_for_electerm_terminal_idle',
      {
        description: 'Wait until the active terminal stops producing output, then return its content. ' +
          'Use this after send_electerm_terminal_command to know when the command has finished. ' +
          'The terminal is considered idle when no data has arrived for ~4 seconds. ' +
          'Returns output and elapsed time; timedOut=true if the command was still running at the timeout.',
        inputSchema: {
          tabId: z.string().optional().describe('Tab ID to watch (default: active tab)'),
          timeout: z.number().optional().describe('Max milliseconds to wait for idle (default: 30000, max: 120000)'),
          lines: z.number().optional().describe('Lines of terminal output to return when idle (default: 50)'),
          minWait: z.number().optional().describe('Initial delay before polling starts, ms (default: 1000)')
        }
      },
      async (args) => {
        // IPC timeout must exceed the tool timeout by a safe margin
        const toolTimeout = Math.min(args?.timeout || 30000, 120000)
        const ipcTimeout = toolTimeout + 10000
        const result = await self.sendToRenderer(
          'tool-call',
          { toolName: 'wait_for_terminal_idle', args },
          ipcTimeout
        )
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'get_electerm_terminal_status',
      {
        description: 'Get the current status of a terminal tab. Returns whether it is actively receiving data (running), idle (no data for 4+ seconds), or has a password prompt, plus whether session keepalive is on. Also returns the last 20 lines of terminal output. This is a lightweight, non-blocking check ideal for monitoring long-running commands.',
        inputSchema: {
          tabId: z.string().optional().describe('Tab ID to check (default: active tab)')
        }
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'get_terminal_status', args
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'set_electerm_terminal_keepalive',
      {
        description: 'Turn session keepalive on or off for a terminal session. ' +
          'While on, electerm writes a newline to the session whenever it has been idle, resetting shell idle timeouts so the connection is not killed. ' +
          'Use it before long work on a session nobody is typing into, e.g. a large electerm_sftp_upload / electerm_sftp_download. ' +
          'Returns the resulting state as `keepalive`.',
        inputSchema: {
          enabled: z.boolean().describe('true to start sending keepalive, false to stop'),
          tabId: z.string().optional().describe('Tab ID (default: active tab)')
        }
      },
      async ({ enabled, tabId }) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'set_terminal_keepalive',
          args: { enabled, tabId }
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'cancel_electerm_terminal_command',
      {
        description: 'Cancel the currently running command in a terminal by sending Ctrl+C. Use this to interrupt a long-running or stuck command.',
        inputSchema: {
          tabId: z.string().optional().describe('Tab ID to cancel command in (default: active tab)')
        }
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'cancel_terminal_command', args
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'execute_electerm_command',
      {
        description: 'Execute a non-interactive shell command and return a structured result: { stdout, stderr, exitCode, durationMs, timedOut, truncated, mode, tabId }. ' +
          'On SSH tabs this uses a dedicated exec channel (mode="exec") with real stdout/stderr/exit code capture — no terminal buffer parsing needed. ' +
          'On other tabs it falls back to sentinel-based PTY capture (mode="pty", stderr merged into stdout). ' +
          'Prefer this over send_electerm_terminal_command + wait_for_electerm_terminal_idle for regular commands like git status, docker ps, npm test. ' +
          'For interactive programs (vim, top, ssh) use the terminal send/read tools instead. ' +
          'For long-running commands pass wait=false: runs in the background and returns an MCP task handle (poll with tasks/get, stop with tasks/cancel). Requires the MCP Tasks extension.',
        inputSchema: {
          command: z.string().describe('The shell command to execute'),
          tabId: z.string().optional().describe('Tab ID to run on (default: active tab)'),
          timeoutMs: z.number().optional().describe('Max execution time in ms (default: 120000, max: 600000). On timeout returns partial output with timedOut=true.'),
          wait: z.boolean().optional().describe('Wait for completion and return the structured result (default: true). Set false for long-running commands to get a task handle instead.'),
          mode: z.enum(['exec', 'pty']).optional().describe('Execution mode: "exec" (default) uses the SSH exec channel with PTY fallback; "pty" forces execution in the visible terminal (for commands needing a TTY: colors, sudo prompts, TTY-aware tools). Ignored when wait=false.')
        }
      },
      async (args, ctx) => {
        const check = self.validateCommand(args?.command || '')
        if (!check.allowed) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: check.reason }, null, 2) }], isError: true }
        }

        // Async path: run in background, return a task handle instead of the result
        if (args?.wait === false) {
          // Requires the MCP Tasks extension — there is no non-task way to
          // poll or cancel an async run (legacy background tools were removed).
          if (!ctx?.clientSupportsTasks || !self.taskManager) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'wait=false requires the MCP Tasks extension (io.modelcontextprotocol/tasks). ' +
                    'Declare the extension in client capabilities, or call with wait=true (default) to run synchronously.'
                }, null, 2)
              }],
              isError: true
            }
          }
          const bg = await self.sendToRenderer('tool-call', {
            toolName: 'run_background_command',
            args: { command: args.command, tabId: args.tabId }
          })
          const task = self.taskManager.create({
            toolName: 'execute_electerm_command',
            meta: {
              bgTaskId: bg.taskId,
              tabId: bg.tabId,
              command: args.command,
              startedAt: Date.now()
            }
          })
          return {
            resultType: 'task',
            task: self.taskManager.toWire(task)
          }
        }

        // Sync path: wait for completion, return structured result
        const timeoutMs = Math.min(Math.max(args?.timeoutMs || self.config.execTimeoutMs || 120000, 1000), 600000)
        const result = await self.sendToRenderer(
          'tool-call',
          {
            toolName: 'execute_command',
            args: {
              command: args.command,
              tabId: args.tabId,
              timeoutMs,
              maxOutputBytes: self.config.execMaxOutputBytes || 204800,
              mode: args.mode
            }
          },
          timeoutMs + 15000
        )
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    // The two command tools above reject with a reason, but an agent cannot
    // know where the boundary is in advance — in whitelist mode a non-matching
    // command is refused outright. Registered unconditionally (never behind a
    // config switch) so it is available whenever the command tools are.
    server.registerTool(
      'get_electerm_command_rules',
      {
        description: 'Get the command rules enforced by send_electerm_terminal_command and execute_electerm_command, so a command can be checked before it is sent. ' +
          'Returns { mode, builtinBlacklist, commandBlacklist, commandWhitelist }. Entries are regular expression sources tested against the command string with RegExp#test. For example, "^ls" matches command strings starting with "ls". ' +
          'The built-in and configured blacklists take precedence over the whitelist. A non-empty whitelist requires the command to match at least one whitelist entry. Configured patterns are returned even if invalid. Invalid blacklist entries are skipped, and invalid whitelist entries never match. ' +
          'These are the rules the running instance started with — editing the widget config takes effect only after a restart. They guard against accidents, not a determined bypass: an allowed command still runs with the session user\'s full rights on the remote host.',
        inputSchema: undefined
      },
      async () => {
        const rules = self.getCommandRules()
        return { content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }] }
      }
    )

    // ==================== Direct Tab Open APIs (always enabled) ====================

    server.registerTool(
      'open_electerm_tab_ssh',
      {
        description: 'Open a new SSH terminal tab directly with connection parameters (no bookmark created)',
        inputSchema: sshBookmarkSchema
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'open_tab',
          args: { ...sanitizeTabArgs(args), type: 'ssh' }
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'open_electerm_tab_telnet',
      {
        description: 'Open a new Telnet terminal tab directly with connection parameters (no bookmark created)',
        inputSchema: telnetBookmarkSchema
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'open_tab',
          args: { ...sanitizeTabArgs(args), type: 'telnet' }
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'open_electerm_tab_serial',
      {
        description: 'Open a new Serial terminal tab directly with connection parameters (no bookmark created)',
        inputSchema: serialBookmarkSchema
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'open_tab',
          args: { ...sanitizeTabArgs(args), type: 'serial' }
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'open_electerm_tab_local',
      {
        description: 'Open a new Local terminal tab directly with connection parameters (no bookmark created)',
        inputSchema: localBookmarkSchema
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'open_tab',
          args: { ...sanitizeTabArgs(args), type: 'local' }
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ==================== Bookmark APIs ====================
    if (this.config.enableBookmarks) {
      server.registerTool(
        'list_electerm_bookmarks',
        {
          description: 'List all electerm SSH/terminal bookmarks',
          inputSchema: {}
        },
        async (args) => {
          let result = await self.sendToRenderer('tool-call', { toolName: 'list_bookmarks', args: {} })
          const keyword = self.config.bookmarkKeyword
          if (keyword && Array.isArray(result)) {
            const lower = keyword.toLowerCase()
            result = result.filter(b => (b.title || '').toLowerCase().includes(lower))
          }
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'get_electerm_bookmark',
        {
          description: 'Get a specific electerm bookmark by ID',
          inputSchema: {
            id: z.string().describe('Bookmark ID')
          }
        },
        async ({ id }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'get_bookmark', args: { id } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'add_electerm_bookmark_ssh',
        {
          description: 'Add a new SSH bookmark to electerm',
          inputSchema: sshBookmarkSchema
        },
        async (args) => {
          const result = await self.sendToRenderer('tool-call', {
            toolName: 'add_bookmark',
            args: { ...sanitizeTabArgs(args), type: 'ssh' }
          })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'add_electerm_bookmark_telnet',
        {
          description: 'Add a new Telnet bookmark to electerm',
          inputSchema: telnetBookmarkSchema
        },
        async (args) => {
          const result = await self.sendToRenderer('tool-call', {
            toolName: 'add_bookmark',
            args: { ...sanitizeTabArgs(args), type: 'telnet' }
          })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'add_electerm_bookmark_serial',
        {
          description: 'Add a new Serial bookmark to electerm',
          inputSchema: serialBookmarkSchema
        },
        async (args) => {
          const result = await self.sendToRenderer('tool-call', {
            toolName: 'add_bookmark',
            args: { ...sanitizeTabArgs(args), type: 'serial' }
          })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'add_electerm_bookmark_local',
        {
          description: 'Add a new Local terminal bookmark to electerm',
          inputSchema: localBookmarkSchema
        },
        async (args) => {
          const result = await self.sendToRenderer('tool-call', {
            toolName: 'add_bookmark',
            args: { ...sanitizeTabArgs(args), type: 'local' }
          })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'edit_electerm_bookmark',
        {
          description: 'Edit an existing electerm bookmark',
          inputSchema: {
            id: z.string().describe('Bookmark ID to edit'),
            updates: z.record(z.any()).describe('Fields to update')
          }
        },
        async ({ id, updates }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'edit_bookmark', args: { id, updates: sanitizeTabArgs(updates) } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'delete_electerm_bookmark',
        {
          description: 'Delete an electerm bookmark',
          inputSchema: {
            id: z.string().describe('Bookmark ID to delete')
          }
        },
        async ({ id }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'delete_bookmark', args: { id } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'open_electerm_bookmark',
        {
          description: 'Open an electerm bookmark in a new tab',
          inputSchema: {
            id: z.string().describe('Bookmark ID to open')
          }
        },
        async ({ id }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'open_bookmark', args: { id } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )
    }

    // ==================== Bookmark Group APIs ====================
    if (this.config.enableBookmarkGroups) {
      server.registerTool(
        'list_electerm_bookmark_groups',
        {
          description: 'List all electerm bookmark groups/folders',
          inputSchema: z.object({})
        },
        async () => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'list_bookmark_groups', args: {} })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'add_electerm_bookmark_group',
        {
          description: 'Add a new electerm bookmark group',
          inputSchema: {
            title: z.string().describe('Group title'),
            parentId: z.string().optional().describe('Optional parent group ID')
          }
        },
        async ({ title, parentId }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'add_bookmark_group', args: { title, parentId } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )
    }

    // ==================== SFTP APIs ====================
    if (this.config.enableSftp) {
      server.registerTool(
        'electerm_sftp_list',
        {
          description: 'List files and folders in a remote directory on the SSH-connected tab',
          inputSchema: {
            tabId: z.string().optional().describe('SSH tab ID (default: active tab)'),
            remotePath: z.string().describe('Remote directory path to list')
          }
        },
        async ({ tabId, remotePath }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'sftp_list', args: { tabId, remotePath } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'electerm_sftp_stat',
        {
          description: 'Get file or directory stat/info on the remote SSH server',
          inputSchema: {
            tabId: z.string().optional().describe('SSH tab ID (default: active tab)'),
            remotePath: z.string().describe('Remote file or directory path')
          }
        },
        async ({ tabId, remotePath }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'sftp_stat', args: { tabId, remotePath } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'electerm_sftp_read_file',
        {
          description: 'Read the content of a remote file on the SSH server',
          inputSchema: {
            tabId: z.string().optional().describe('SSH tab ID (default: active tab)'),
            remotePath: z.string().describe('Remote file path to read')
          }
        },
        async ({ tabId, remotePath }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'sftp_read_file', args: { tabId, remotePath } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      // Write tools move files between the remote server and this machine, so
      // a client that can call them can also read and write arbitrary local
      // paths. Opt-in, like the settings tools.
      if (this.config.enableSftpWrite) {
        server.registerTool(
          'electerm_sftp_del_file_or_folder',
          {
            description: 'Delete a file or folder on the remote SSH server',
            inputSchema: {
              tabId: z.string().optional().describe('SSH tab ID (default: active tab)'),
              remotePath: z.string().describe('Remote file or directory path to delete')
            }
          },
          async ({ tabId, remotePath }) => {
            const result = await self.sendToRenderer('tool-call', { toolName: 'sftp_del', args: { tabId, remotePath } })
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }
        )

        server.registerTool(
          'electerm_sftp_upload',
          {
            description: 'Upload a local file or folder to the remote SSH server using the SFTP transfer panel',
            inputSchema: {
              tabId: z.string().optional().describe('SSH tab ID (default: active tab)'),
              localPath: z.string().describe('Local file or folder path to upload'),
              remotePath: z.string().describe('Remote destination path'),
              conflictPolicy: z.enum(['mergeOrOverwriteAll', 'renameAll']).optional().describe('Conflict policy: mergeOrOverwriteAll or renameAll (default: mergeOrOverwriteAll). Only applies when autoConfirmTransfers is on; otherwise the user resolves conflicts in the transfer dialog.')
            }
          },
          async ({ tabId, localPath, remotePath, conflictPolicy }) => {
            const result = await self.sendToRenderer('tool-call', {
              toolName: 'sftp_upload',
              args: { tabId, localPath, remotePath, conflictPolicy },
              transferPolicy: self.getTransferPolicy()
            })
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }
        )

        server.registerTool(
          'electerm_sftp_download',
          {
            description: 'Download a remote file or folder from the SSH server to a local path using the SFTP transfer panel',
            inputSchema: {
              tabId: z.string().optional().describe('SSH tab ID (default: active tab)'),
              remotePath: z.string().describe('Remote file or directory path to download'),
              localPath: z.string().describe('Local destination path'),
              conflictPolicy: z.enum(['mergeOrOverwriteAll', 'renameAll']).optional().describe('Conflict policy: mergeOrOverwriteAll or renameAll (default: mergeOrOverwriteAll). Only applies when autoConfirmTransfers is on; otherwise the user resolves conflicts in the transfer dialog.')
            }
          },
          async ({ tabId, remotePath, localPath, conflictPolicy }) => {
            const result = await self.sendToRenderer('tool-call', {
              toolName: 'sftp_download',
              args: { tabId, remotePath, localPath, conflictPolicy },
              transferPolicy: self.getTransferPolicy()
            })
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }
        )

        server.registerTool(
          'electerm_zmodem_upload',
          {
            description: 'Upload local files to the remote SSH server using trzsz (trz) or rzsz (rz). The SSH tab must have the chosen protocol installed.',
            inputSchema: {
              tabId: z.string().optional().describe('SSH tab ID (default: active tab)'),
              files: z.array(z.string()).describe('List of local file paths to upload'),
              protocol: z.enum(['trzsz', 'rzsz']).optional().describe('Transfer protocol: trzsz (trz) or rzsz (rz) (default: rzsz)')
            }
          },
          async ({ tabId, files, protocol }) => {
            const result = await self.sendToRenderer('tool-call', { toolName: 'zmodem_upload', args: { tabId, files, protocol } })
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }
        )

        server.registerTool(
          'electerm_zmodem_download',
          {
            description: 'Download remote files from the SSH server using trzsz (tsz) or rzsz (sz). The SSH tab must have the chosen protocol installed.',
            inputSchema: {
              tabId: z.string().optional().describe('SSH tab ID (default: active tab)'),
              remoteFiles: z.array(z.string()).describe('List of remote file paths to download'),
              saveFolder: z.string().describe('Local folder path to save downloaded files'),
              protocol: z.enum(['trzsz', 'rzsz']).optional().describe('Transfer protocol: trzsz (tsz) or rzsz (sz) (default: rzsz)')
            }
          },
          async ({ tabId, remoteFiles, saveFolder, protocol }) => {
            const result = await self.sendToRenderer('tool-call', { toolName: 'zmodem_download', args: { tabId, remoteFiles, saveFolder, protocol } })
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
          }
        )
      }

      server.registerTool(
        'electerm_sftp_transfer_list',
        {
          description: 'Get the list of all currently active/pending SFTP file transfers',
          inputSchema: z.object({})
        },
        async () => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'sftp_transfer_list', args: {} })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'electerm_sftp_transfer_history',
        {
          description: 'Get the history of completed/failed SFTP file transfers',
          inputSchema: z.object({})
        },
        async () => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'sftp_transfer_history', args: {} })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )
    }

    // ==================== Settings APIs ====================
    if (this.config.enableSettings) {
      server.registerTool(
        'get_electerm_settings',
        {
          description: 'Get current electerm application settings',
          inputSchema: undefined
        },
        async () => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'get_settings', args: {} })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )
    }
  }

  // Start the MCP server
  async start () {
    const { host, port } = this.config

    // Set up IPC response handler
    this.ipcHandler = (event, response) => {
      const { requestId, result, error } = response
      const pending = this.pendingRequests.get(requestId)
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(requestId)
        if (error) {
          pending.reject(new Error(error))
        } else {
          pending.resolve(result)
        }
      }
    }
    ipcMain.on('mcp-response', this.ipcHandler)

    // Create MCP task manager (SEP-2663) when the tasks extension is enabled
    if (this.config.enableTasks) {
      this.taskManager = new TaskManager({
        ttl: this.config.taskTtlMs > 0 ? this.config.taskTtlMs : 3600000
      })
      this.taskManager.onGet = (task) => this.refreshTask(task)
      this.taskManager.onCancel = (task) => this.cancelTaskRemote(task)
      this.taskManager.onSweep = (task) => this.sweepTaskRemote(task)
    }

    // Create MCP server
    this.mcpServer = new McpServer({
      name: 'electerm-mcp-server',
      version: widgetInfo.version,
      taskManager: this.taskManager
    })

    // Register all tools
    this.registerTools()

    // Create Express app
    const app = express()

    // ── Loopback guard ──────────────────────────────────────────────────────
    // Binding to 127.0.0.1 does not make this server private. A page served
    // from an attacker's domain can point that domain at 127.0.0.1 (DNS
    // rebinding) and then talk to us same-origin, so CORS never applies and
    // omitting Access-Control-Allow-Origin protects nothing — the page can
    // call execute_electerm_command and get a shell. What is left is:
    //   1. the Host it claims to be talking to, which a rebound page cannot
    //      make loopback-looking while still being same-origin with itself;
    //   2. any Origin header at all — no browser client is supported, local
    //      MCP clients are not browsers and do not send one.
    // Both run before the body parser so an unauthenticated request is refused
    // before its JSON is read.
    const bindHost = String(host || '127.0.0.1').trim().toLowerCase()
    const allowedHosts = buildAllowedHosts(bindHost, port)
    // bound to 0.0.0.0/:: any hostname reaches us, so the Host check cannot
    // mean anything; the API key is the only boundary left in that case
    const checkHost = !isWildcardBind(bindHost)

    const deny = (req, res, status, reason) => {
      this.reportEvent({
        type: 'request',
        ok: false,
        from: req.socket && req.socket.remoteAddress,
        msg: `${req.method} ${req.path} -> ${status} ${reason}`
      })
      res.status(status).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: `Forbidden: ${reason}` },
        id: null
      })
    }

    app.use((req, res, next) => {
      if (checkHost) {
        const hostHeader = String(req.headers.host || '').trim().toLowerCase()
        if (!allowedHosts.has(hostHeader)) {
          deny(req, res, 403, 'invalid Host header')
          return
        }
      }
      if (req.headers.origin) {
        deny(req, res, 403, 'unexpected Origin header')
        return
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
      }
      next()
    })

    // Authenticate every request. The key is never empty (constructor), and it
    // is accepted either as `Authorization: Bearer <key>` or as `?apiKey=<key>`
    // in the URL — the latter so the copied server URL is the whole client
    // configuration, instead of a URL plus a header the user has to find a
    // place for in each client.
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization || ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      const provided = token || String(req.query.apiKey || '')
      if (!apiKeyMatches(provided, this.config.apiKey)) {
        this.reportEvent({
          type: 'auth',
          ok: false,
          from: req.socket && req.socket.remoteAddress,
          // path only: the query carries the key, and this log is readable
          // (and exportable) from the instance panel
          msg: `${req.method} ${req.path} -> 401 Unauthorized`
        })
        res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Unauthorized: invalid or missing API key'
          },
          id: null
        })
        return
      }
      next()
    })

    app.use(express.json())

    const self = this

    // Handle MCP requests
    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id']

      try {
        let transport = sessionId ? self.transports[sessionId] : null

        if (!transport) {
          // Create new transport for new session
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => uid(),
            onsessioninitialized: (sid) => {
              self.transports[sid] = transport
              self.reportEvent({
                type: 'session',
                ok: true,
                from: req.socket && req.socket.remoteAddress,
                msg: `new session ${sid}`
              })
            }
          })

          transport.onclose = () => {
            const sid = Object.keys(self.transports).find(k => self.transports[k] === transport)
            if (sid) {
              delete self.transports[sid]
            }
          }

          await self.mcpServer.connect(transport)
        }

        await transport.handleRequest(req, res, req.body)
        self.reportEvent({
          type: 'request',
          ok: res.statusCode < 400,
          from: req.socket && req.socket.remoteAddress,
          msg: `POST /mcp${sessionId ? ' (session ' + sessionId + ')' : ''} -> ${res.statusCode}`
        })
      } catch (error) {
        console.error('Error handling MCP request:', error)
        self.logLine('error', `request failed: ${error && error.message ? error.message : error}`)
        self.reportEvent({
          type: 'request',
          ok: false,
          from: req.socket && req.socket.remoteAddress,
          msg: `POST /mcp -> 500 ${error && error.message ? error.message : error}`
        })
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error'
            },
            id: null
          })
        }
      }
    })

    // Handle GET requests for SSE streams
    app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id']
      if (!sessionId || !self.transports[sessionId]) {
        self.reportEvent({
          type: 'request',
          ok: false,
          from: req.socket && req.socket.remoteAddress,
          msg: 'GET /mcp -> 400 invalid or missing session ID'
        })
        res.status(400).send('Invalid or missing session ID')
        return
      }

      const transport = self.transports[sessionId]
      await transport.handleRequest(req, res)
    })

    // Handle DELETE requests for session termination
    app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id']
      if (!sessionId || !self.transports[sessionId]) {
        self.reportEvent({
          type: 'request',
          ok: false,
          from: req.socket && req.socket.remoteAddress,
          msg: 'DELETE /mcp -> 400 invalid or missing session ID'
        })
        res.status(400).send('Invalid or missing session ID')
        return
      }

      const transport = self.transports[sessionId]
      await transport.handleRequest(req, res)
      self.reportEvent({
        type: 'session',
        ok: null,
        from: req.socket && req.socket.remoteAddress,
        msg: `session ${sessionId} terminated`
      })
    })

    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(port, host, (err) => {
        if (err) {
          console.error('MCP Server error:', err)
          this.logLine('error', `listen failed: ${err.message}`)
          reject(err)
          return
        }

        const serverInfo = {
          // the key rides in the URL so that "copy the URL" is the whole
          // client setup: paste it, done, no header to find a field for
          url: `http://${host}:${port}/mcp?apiKey=${encodeURIComponent(self.config.apiKey)}`,
          protocol: 'mcp',
          version: self.mcpServer.supportedProtocolVersions[0],
          apiKey: self.config.apiKey
        }
        const msg = `MCP Server is running at http://${host}:${port}/mcp (API key required)`
        self.logLine('info', `API key required, ${Object.keys(self.config).length} config options applied`)
        resolve({
          serverInfo,
          msg,
          success: true
        })
      })

      this.httpServer.on('error', (err) => {
        console.error('MCP Server error:', err)
        this.logLine('error', `server error: ${err.message}`)
        reject(err)
      })
    })
  }

  // Stop the MCP server
  async stop () {
    // Remove IPC handler
    if (this.ipcHandler) {
      ipcMain.removeListener('mcp-response', this.ipcHandler)
      this.ipcHandler = null
    }

    // Destroy task manager (stops the TTL sweep timer)
    if (this.taskManager) {
      this.taskManager.destroy()
      this.taskManager = null
    }

    // Clear pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Server stopping'))
    }
    this.pendingRequests.clear()

    // Close all transports
    for (const sessionId of Object.keys(this.transports)) {
      try {
        await this.transports[sessionId].close()
      } catch (e) {
        console.error(`Error closing transport ${sessionId}:`, e)
        this.logLine('warn', `closing transport ${sessionId} failed: ${e.message}`)
      }
    }
    this.transports = {}

    // Close MCP server
    if (this.mcpServer) {
      await this.mcpServer.close()
      this.mcpServer = null
    }

    // Close HTTP server
    return new Promise((resolve, reject) => {
      if (this.httpServer) {
        this.httpServer.close((err) => {
          if (err) {
            console.error('Error stopping MCP server:', err)
            reject(err)
          } else {
            this.httpServer = null
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }
}

function widgetRun (instanceConfig, ctx = {}) {
  const config = { ...getDefaultConfig(), ...instanceConfig }
  const mcpServer = new ElectermMCPServer(config, ctx)

  return {
    instanceId: mcpServer.instanceId,
    start: () => mcpServer.start(),
    stop: () => mcpServer.stop()
  }
}

module.exports = {
  widgetInfo,
  widgetRun,
  _ElectermMCPServer: ElectermMCPServer
}

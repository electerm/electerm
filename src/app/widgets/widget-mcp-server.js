/**
 * MCP Server Widget
 * Exposes electerm store APIs via Model Context Protocol
 * Runs in main process and uses IPC to communicate with frontend
 * Uses a simple local MCP implementation
 */

const { ipcMain } = require('electron')
const { McpServer } = require('../mcp/server/mcp.js')
const { StreamableHTTPServerTransport } = require('../mcp/server/streamableHttp.js')
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
      description: 'Optional API key for authenticating MCP requests. If set, clients must send this in the Authorization header as: Bearer <apiKey>. Leave empty to skip authentication.'
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
      description: 'Enable SFTP APIs (list, stat, read, delete, upload, download, trzsz)'
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
    }
  ]
}

function getDefaultConfig () {
  return widgetInfo.configs.reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})
}

class ElectermMCPServer {
  constructor (config) {
    this.config = config
    // API key is optional - skip auth if not provided
    this.instanceId = uid()
    this.httpServer = null
    this.mcpServer = null
    this.ipcHandler = null
    this.pendingRequests = new Map()
    this.transports = {}
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

  // Validate a command against whitelist/blacklist rules.
  // Returns { allowed: true } or { allowed: false, reason: string }
  validateCommand (command) {
    // 1. Always-on built-in blacklist
    for (const pattern of ElectermMCPServer.BUILTIN_BLACKLIST) {
      if (pattern.test(command)) {
        return { allowed: false, reason: `Command blocked by built-in safety rule: ${pattern}` }
      }
    }

    // 2. User-defined blacklist (newline-separated regex strings)
    const userBlacklist = (this.config.commandBlacklist || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    for (const raw of userBlacklist) {
      try {
        if (new RegExp(raw).test(command)) {
          return { allowed: false, reason: `Command blocked by blacklist pattern: ${raw}` }
        }
      } catch (_) {
        // ignore invalid regex in config
      }
    }

    // 3. User-defined whitelist (newline-separated regex strings)
    //    Only enforced when at least one pattern is configured.
    const userWhitelist = (this.config.commandWhitelist || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    if (userWhitelist.length > 0) {
      const allowed = userWhitelist.some(raw => {
        try {
          return new RegExp(raw).test(command)
        } catch (_) {
          return false
        }
      })
      if (!allowed) {
        return { allowed: false, reason: 'Command not in whitelist' }
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
        description: 'Send a command to the active electerm terminal',
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
        description: 'Get the current status of a terminal tab. Returns whether it is actively receiving data (running), idle (no data for 4+ seconds), or has a password prompt. Also returns the last 20 lines of terminal output. This is a lightweight, non-blocking check ideal for monitoring long-running commands.',
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

    // ==================== Background Task APIs ====================

    server.registerTool(
      'run_electerm_background_command',
      {
        description: 'Run a command in the background using nohup. The command runs independently of the terminal session — the terminal is freed immediately. Returns a taskId for monitoring. Use get_electerm_background_task_status and get_electerm_background_task_log to check progress. Works best with SSH sessions where monitoring uses a separate exec channel.',
        inputSchema: {
          command: z.string().describe('The shell command to run in the background'),
          tabId: z.string().optional().describe('Tab ID to run on (default: active tab)')
        }
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'run_background_command', args
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'get_electerm_background_task_status',
      {
        description: 'Check the status of a background task. Returns whether it is still running, has completed (with exit code), or is unknown. For SSH sessions, this uses a separate exec channel and does not interfere with the terminal.',
        inputSchema: {
          taskId: z.string().describe('Task ID returned by run_electerm_background_command')
        }
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'get_background_task_status', args
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'get_electerm_background_task_log',
      {
        description: 'Read the output log of a background task. Returns the last N lines of output. Useful for monitoring progress of long-running commands like builds, deployments, or installations.',
        inputSchema: {
          taskId: z.string().describe('Task ID returned by run_electerm_background_command'),
          lines: z.number().optional().describe('Number of recent log lines to return (default: 100)')
        }
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'get_background_task_log', args
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    )

    server.registerTool(
      'cancel_electerm_background_task',
      {
        description: 'Cancel a running background task by killing its process. The task status will be set to cancelled.',
        inputSchema: {
          taskId: z.string().describe('Task ID returned by run_electerm_background_command')
        }
      },
      async (args) => {
        const result = await self.sendToRenderer('tool-call', {
          toolName: 'cancel_background_task', args
        })
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
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
          args: { ...args, type: 'ssh' }
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
          args: { ...args, type: 'telnet' }
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
          args: { ...args, type: 'serial' }
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
          args: { ...args, type: 'local' }
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
            args: { ...args, type: 'ssh' }
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
            args: { ...args, type: 'telnet' }
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
            args: { ...args, type: 'serial' }
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
            args: { ...args, type: 'local' }
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
          const result = await self.sendToRenderer('tool-call', { toolName: 'edit_bookmark', args: { id, updates } })
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
            conflictPolicy: z.enum(['mergeOrOverwriteAll', 'renameAll']).optional().describe('Conflict policy: mergeOrOverwriteAll or renameAll (default: mergeOrOverwriteAll)')
          }
        },
        async ({ tabId, localPath, remotePath, conflictPolicy }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'sftp_upload', args: { tabId, localPath, remotePath, conflictPolicy } })
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
            conflictPolicy: z.enum(['overwrite', 'rename']).optional().describe('Conflict policy: overwrite or rename (default: overwrite)')
          }
        },
        async ({ tabId, remotePath, localPath, conflictPolicy }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'sftp_download', args: { tabId, remotePath, localPath, conflictPolicy } })
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

    // Create MCP server
    this.mcpServer = new McpServer({
      name: 'electerm-mcp-server',
      version: widgetInfo.version
    })

    // Register all tools
    this.registerTools()

    // Create Express app
    const app = express()
    app.use(express.json())

    // Handle CORS — restrict to same-origin only (no wildcard)
    app.use((req, res, next) => {
      const allowedOrigin = this.config.allowedOrigin || ''
      if (allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
      }
      // Do NOT set Access-Control-Allow-Origin when no origin is configured
      // This blocks cross-origin browser requests by default
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, Authorization')
      if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
      }
      next()
    })

    // Authenticate requests with API key (only if apiKey is configured)
    if (this.config.apiKey) {
      app.use((req, res, next) => {
        const authHeader = req.headers.authorization || ''
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
        if (!token || token !== this.config.apiKey) {
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
    }

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
      } catch (error) {
        console.error('Error handling MCP request:', error)
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
        res.status(400).send('Invalid or missing session ID')
        return
      }

      const transport = self.transports[sessionId]
      await transport.handleRequest(req, res)
    })

    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(port, host, (err) => {
        if (err) {
          console.error('MCP Server error:', err)
          reject(err)
          return
        }

        const serverInfo = {
          url: `http://${host}:${port}/mcp`,
          protocol: 'mcp',
          version: '2024-11-05',
          apiKey: self.config.apiKey
        }
        const authNote = self.config.apiKey ? '(API key required)' : '(no auth required)'
        const msg = `MCP Server is running at ${serverInfo.url} ${authNote}`
        resolve({
          serverInfo,
          msg,
          success: true
        })
      })

      this.httpServer.on('error', (err) => {
        console.error('MCP Server error:', err)
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

function widgetRun (instanceConfig) {
  const config = { ...getDefaultConfig(), ...instanceConfig }
  const mcpServer = new ElectermMCPServer(config)

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

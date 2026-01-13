/**
 * MCP Server Widget
 * Exposes electerm store APIs via Model Context Protocol
 * Runs in main process and uses IPC to communicate with frontend
 * Uses a simple local MCP implementation
 */

const { ipcMain } = require('electron')
const { McpServer } = require('../mcp/server/mcp.js')
const { StreamableHTTPServerTransport } = require('../mcp/server/streamableHttp.js')
const { z } = require('zod')
const express = require('express')
const uid = require('../common/uid')
const globalState = require('../lib/glob-state')

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
      name: 'enableBookmarks',
      type: 'boolean',
      default: true,
      description: 'Enable bookmark APIs (list, get, add, edit, delete)'
    },
    {
      name: 'enableBookmarkGroups',
      type: 'boolean',
      default: true,
      description: 'Enable bookmark group APIs'
    },
    {
      name: 'enableQuickCommands',
      type: 'boolean',
      default: true,
      description: 'Enable quick command APIs (list, add, edit, delete, run)'
    },
    {
      name: 'enableHistory',
      type: 'boolean',
      default: true,
      description: 'Enable history APIs'
    },
    {
      name: 'enableTransfer',
      type: 'boolean',
      default: false,
      description: 'Enable file transfer APIs'
    },
    {
      name: 'enableSettings',
      type: 'boolean',
      default: false,
      description: 'Enable settings APIs'
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
    this.instanceId = uid()
    this.httpServer = null
    this.mcpServer = null
    this.ipcHandler = null
    this.pendingRequests = new Map()
    this.transports = {}
  }

  // Send request to renderer process via IPC
  sendToRenderer (action, data) {
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
      }, 30000)

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

    // ==================== Bookmark APIs ====================
    if (this.config.enableBookmarks) {
      server.registerTool(
        'list_electerm_bookmarks',
        {
          description: 'List all electerm SSH/terminal bookmarks',
          inputSchema: {
            groupId: z.string().optional().describe('Optional: Filter by bookmark group ID')
          }
        },
        async (args) => {
          const groupId = args?.groupId
          const result = await self.sendToRenderer('tool-call', { toolName: 'list_bookmarks', args: { groupId } })
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
          inputSchema: {
            title: z.string().describe('Bookmark title'),
            host: z.string().describe('SSH host address'),
            port: z.number().optional().describe('SSH port (default 22)'),
            username: z.string().optional().describe('SSH username'),
            password: z.string().optional().describe('SSH password'),
            authType: z.enum(['password', 'privateKey', 'keyboard-interactive']).optional().describe('Authentication type'),
            privateKey: z.string().optional().describe('Private key content (for privateKey auth)'),
            passphrase: z.string().optional().describe('Private key passphrase'),
            useSshAgent: z.boolean().optional().describe('Use SSH agent'),
            description: z.string().optional().describe('Bookmark description')
          }
        },
        async ({ title, host, port, username, password, authType, privateKey, passphrase, useSshAgent, description }) => {
          const result = await self.sendToRenderer('tool-call', {
            toolName: 'add_bookmark',
            args: { title, host, port, username, password, authType, privateKey, passphrase, useSshAgent, description, type: 'ssh' }
          })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'add_electerm_bookmark_telnet',
        {
          description: 'Add a new Telnet bookmark to electerm',
          inputSchema: {
            title: z.string().describe('Bookmark title'),
            host: z.string().describe('Telnet host address'),
            port: z.number().optional().describe('Telnet port (default 23)'),
            username: z.string().optional().describe('Telnet username'),
            password: z.string().optional().describe('Telnet password'),
            loginPrompt: z.string().optional().describe('Login prompt regex'),
            passwordPrompt: z.string().optional().describe('Password prompt regex'),
            description: z.string().optional().describe('Bookmark description')
          }
        },
        async ({ title, host, port, username, password, loginPrompt, passwordPrompt, description }) => {
          const result = await self.sendToRenderer('tool-call', {
            toolName: 'add_bookmark',
            args: { title, host, port, username, password, loginPrompt, passwordPrompt, description, type: 'telnet' }
          })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'add_electerm_bookmark_serial',
        {
          description: 'Add a new Serial bookmark to electerm',
          inputSchema: {
            title: z.string().describe('Bookmark title'),
            path: z.string().describe('Serial device path'),
            baudRate: z.number().optional().describe('Baud rate (default 9600)'),
            dataBits: z.number().optional().describe('Data bits (default 8)'),
            stopBits: z.number().optional().describe('Stop bits (default 1)'),
            parity: z.enum(['none', 'even', 'odd', 'mark', 'space']).optional().describe('Parity (default none)'),
            rtscts: z.boolean().optional().describe('RTS/CTS flow control'),
            xon: z.boolean().optional().describe('XON/XOFF flow control'),
            xoff: z.boolean().optional().describe('XOFF flow control'),
            xany: z.boolean().optional().describe('XANY flow control'),
            description: z.string().optional().describe('Bookmark description')
          }
        },
        async ({ title, path, baudRate, dataBits, stopBits, parity, rtscts, xon, xoff, xany, description }) => {
          const result = await self.sendToRenderer('tool-call', {
            toolName: 'add_bookmark',
            args: { title, path, baudRate, dataBits, stopBits, parity, rtscts, xon, xoff, xany, description, type: 'serial' }
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

    // ==================== Quick Command APIs ====================
    if (this.config.enableQuickCommands) {
      server.registerTool(
        'list_electerm_quick_commands',
        {
          description: 'List all electerm quick commands',
          inputSchema: z.object({})
        },
        async () => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'list_quick_commands', args: {} })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'add_electerm_quick_command',
        {
          description: 'Add a new electerm quick command',
          inputSchema: {
            name: z.string().describe('Quick command name'),
            command: z.string().describe('Command to execute'),
            inputOnly: z.boolean().optional().describe('Input only mode (no enter)'),
            labels: z.array(z.string()).optional().describe('Tags/labels for the command')
          }
        },
        async ({ name, command, inputOnly, labels }) => {
          const result = await self.sendToRenderer('tool-call', {
            toolName: 'add_quick_command',
            args: { name, command, inputOnly, labels }
          })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'run_electerm_quick_command',
        {
          description: 'Run an electerm quick command in the active terminal',
          inputSchema: {
            id: z.string().describe('Quick command ID to run')
          }
        },
        async ({ id }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'run_quick_command', args: { id } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'delete_electerm_quick_command',
        {
          description: 'Delete an electerm quick command',
          inputSchema: {
            id: z.string().describe('Quick command ID to delete')
          }
        },
        async ({ id }) => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'delete_quick_command', args: { id } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )
    }

    // ==================== History APIs ====================
    if (this.config.enableHistory) {
      server.registerTool(
        'list_electerm_history',
        {
          description: 'List electerm connection history',
          inputSchema: {
            limit: z.number().optional().describe('Max number of entries (default 50)')
          }
        },
        async (args) => {
          const limit = args?.limit
          const result = await self.sendToRenderer('tool-call', { toolName: 'list_history', args: { limit } })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'clear_electerm_history',
        {
          description: 'Clear electerm connection history',
          inputSchema: z.object({})
        },
        async () => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'clear_history', args: {} })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )
    }

    // ==================== Transfer APIs ====================
    if (this.config.enableTransfer) {
      server.registerTool(
        'list_electerm_transfers',
        {
          description: 'List active electerm file transfers',
          inputSchema: z.object({})
        },
        async () => {
          const result = await self.sendToRenderer('tool-call', { toolName: 'list_transfers', args: {} })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      )

      server.registerTool(
        'list_electerm_transfer_history',
        {
          description: 'List electerm file transfer history',
          inputSchema: {
            limit: z.number().optional().describe('Max number of entries')
          }
        },
        async (args) => {
          const limit = args?.limit
          const result = await self.sendToRenderer('tool-call', { toolName: 'list_transfer_history', args: { limit } })
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

    // Handle CORS
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id')
      if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
      }
      next()
    })

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
          version: '2024-11-05'
        }
        const msg = `MCP Server is running at ${serverInfo.url}`
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
  widgetRun
}

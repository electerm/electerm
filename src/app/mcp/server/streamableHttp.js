const { z } = require('../../lib/zod')

function zodToJsonSchema (zodSchema) {
  if (!zodSchema) {
    return { type: 'object', properties: {} }
  }
  try {
    if (zodSchema && typeof zodSchema === 'object') {
      const hasZodStandard = Object.values(zodSchema).some(
        v => v && typeof v === 'object' && '~standard' in v
      )
      if (hasZodStandard) {
        const zodObject = z.object(
          Object.fromEntries(
            Object.entries(zodSchema).map(([key, value]) => [key, value])
          )
        )
        const jsonSchema = z.toJSONSchema(zodObject)
        return jsonSchema || { type: 'object', properties: {} }
      }
    }
    if (zodSchema && typeof zodSchema === 'object' && '~standard' in zodSchema) {
      const jsonSchema = z.toJSONSchema(zodSchema)
      return jsonSchema || { type: 'object', properties: {} }
    }
    return { type: 'object', properties: {} }
  } catch (e) {
    return { type: 'object', properties: {} }
  }
}

class StreamableHTTPServerTransport {
  constructor (options) {
    this.sessionIdGenerator = options.sessionIdGenerator
    this.onsessioninitialized = options.onsessioninitialized
    this.onclose = null
    this.server = null
    this.sessionId = null
    this.initialized = false
    // Whether the client advertised the io.modelcontextprotocol/tasks
    // extension — via initialize capabilities or per-request _meta.
    this.clientSupportsTasks = false
  }

  async connect (server) {
    this.server = server
    this.sessionId = this.sessionIdGenerator()
    if (this.onsessioninitialized) {
      this.onsessioninitialized(this.sessionId)
    }
  }

  _sendSSE (res, data) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.write('event: message\n')
    res.write(`data: ${JSON.stringify(data)}\n\n`)
    res.end()
  }

  // Detect tasks-extension support from request params. Accepts both the
  // initialize-time capabilities.extensions and the SEP-2663 per-request
  // _meta["io.modelcontextprotocol/clientCapabilities"].extensions form.
  _captureClientCaps (params) {
    if (!params || typeof params !== 'object') {
      return
    }
    const initExt = params.capabilities && params.capabilities.extensions
    const metaExt = params._meta &&
      params._meta['io.modelcontextprotocol/clientCapabilities'] &&
      params._meta['io.modelcontextprotocol/clientCapabilities'].extensions
    for (const ext of [initExt, metaExt]) {
      if (ext && typeof ext === 'object' && 'io.modelcontextprotocol/tasks' in ext) {
        this.clientSupportsTasks = true
      }
    }
  }

  async _handleTasksGet (request) {
    if (!this.server.taskManager) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: 'Tasks extension not enabled' }
      }
    }
    const taskId = request.params && request.params.taskId
    if (!taskId) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32602, message: 'Missing required param: taskId' }
      }
    }
    try {
      const task = await this.server.taskManager.get(taskId)
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: task
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32602, message: error.message }
      }
    }
  }

  async _handleTasksCancel (request) {
    if (!this.server.taskManager) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: 'Tasks extension not enabled' }
      }
    }
    const taskId = request.params && request.params.taskId
    if (!taskId) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32602, message: 'Missing required param: taskId' }
      }
    }
    try {
      const task = await this.server.taskManager.cancel(taskId)
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: task
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32602, message: error.message }
      }
    }
  }

  async handleRequest (req, res, body) {
    if (body) {
      const request = body
      let result
      if (request.method === 'initialize') {
        this._captureClientCaps(request.params)
        const versions = this.server.supportedProtocolVersions || ['2024-11-05']
        const requested = request.params && request.params.protocolVersion
        const protocolVersion = versions.includes(requested) ? requested : versions[0]
        const capabilities = {
          tools: {
            listChanged: false
          }
        }
        if (this.server.taskManager) {
          capabilities.extensions = {
            'io.modelcontextprotocol/tasks': {}
          }
        }
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion,
            capabilities,
            serverInfo: {
              name: this.server.name,
              version: this.server.version
            }
          }
        }
        res.setHeader('mcp-session-id', this.sessionId)
      } else if (request.method === 'notifications/initialized') {
        this.initialized = true
        res.status(200).end()
        return
      } else if (request.method === 'tools/list') {
        const tools = Array.from(this.server.tools.entries()).map(([name, { description, inputSchema }]) => ({
          name,
          description,
          inputSchema: zodToJsonSchema(inputSchema)
        }))
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: { tools }
        }
      } else if (request.method === 'tools/call') {
        this._captureClientCaps(request.params)
        const { name, arguments: args } = request.params
        const tool = this.server.tools.get(name)
        if (tool) {
          try {
            const toolResult = await tool.handler(args, {
              clientSupportsTasks: this.clientSupportsTasks && !!this.server.taskManager,
              taskManager: this.server.taskManager
            })
            result = {
              jsonrpc: '2.0',
              id: request.id,
              result: toolResult
            }
          } catch (error) {
            result = {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                content: [{ type: 'text', text: error.message }],
                isError: true
              }
            }
          }
        } else {
          result = {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: `Tool not found: ${name}` }
          }
        }
      } else if (request.method === 'tasks/get') {
        result = await this._handleTasksGet(request)
      } else if (request.method === 'tasks/cancel') {
        result = await this._handleTasksCancel(request)
      } else if (request.method === 'tasks/list' || request.method === 'tasks/update' || request.method === 'tasks/result') {
        // tasks/list is unsafe without an authorization context, and
        // tasks/update / tasks/result are only needed for input_required
        // flows — intentionally not implemented (SEP-2663).
        result = {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: `Method not implemented: ${request.method}` }
        }
      } else if (request.method === 'ping') {
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: {}
        }
      } else {
        result = {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: `Method not found: ${request.method}` }
        }
      }
      this._sendSSE(res, result)
    } else {
      if (req.method === 'DELETE') {
        this.close()
        res.status(200).end()
      } else if (req.method === 'GET') {
        // Open a no-op SSE listening stream per MCP Streamable HTTP spec.
        // The server does not currently push server-initiated messages,
        // but keeping the stream alive with heartbeats satisfies strict
        // clients (e.g. Claude Agent SDK) that require a valid SSE stream.
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.status(200)
        // Send an initial SSE comment to flush headers
        res.write(': ping\n\n')
        // Heartbeat every 15s to keep the connection alive
        const heartbeat = setInterval(() => {
          res.write(': ping\n\n')
        }, 15000)
        // Clean up when the client disconnects
        req.on('close', () => {
          clearInterval(heartbeat)
        })
      } else {
        res.status(200).end()
      }
    }
  }

  async close () {
    if (this.onclose) this.onclose()
  }
}

module.exports = { StreamableHTTPServerTransport }

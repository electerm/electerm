class StreamableHTTPServerTransport {
  constructor (options) {
    this.sessionIdGenerator = options.sessionIdGenerator
    this.onsessioninitialized = options.onsessioninitialized
    this.onclose = null
    this.server = null
    this.sessionId = null
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

  async handleRequest (req, res, body) {
    if (body) {
      // POST request with JSON-RPC
      const request = body
      let result
      if (request.method === 'initialize') {
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: this.server.name,
              version: this.server.version
            }
          }
        }
        res.setHeader('mcp-session-id', this.sessionId)
      } else if (request.method === 'tools/list') {
        const tools = Array.from(this.server.tools.entries()).map(([name, { description, inputSchema }]) => ({
          name,
          description,
          inputSchema
        }))
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: { tools }
        }
      } else if (request.method === 'tools/call') {
        const { name, arguments: args } = request.params
        const tool = this.server.tools.get(name)
        if (tool) {
          try {
            const toolResult = await tool.handler(args)
            result = {
              jsonrpc: '2.0',
              id: request.id,
              result: toolResult
            }
          } catch (error) {
            result = {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32603, message: error.message }
            }
          }
        } else {
          result = {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: 'Method not found' }
          }
        }
      } else {
        result = {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32600, message: 'Invalid Request' }
        }
      }
      this._sendSSE(res, result)
    } else {
      // GET or DELETE
      if (req.method === 'DELETE') {
        // Close session
        this.close()
        res.status(200).end()
      } else {
        // GET for SSE or something
        res.status(200).end()
      }
    }
  }

  async close () {
    if (this.onclose) this.onclose()
  }
}

module.exports = { StreamableHTTPServerTransport }

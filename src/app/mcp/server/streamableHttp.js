const { z } = require('zod')

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
      const request = body
      let result
      if (request.method === 'initialize') {
        result = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {
                listChanged: false
              }
            },
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

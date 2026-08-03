class McpServer {
  constructor (options) {
    this.name = options.name
    this.version = options.version
    this.tools = new Map()
    // Optional TaskManager instance (src/app/mcp/server/tasks.js).
    // When set, the transport advertises the io.modelcontextprotocol/tasks
    // extension and serves tasks/get + tasks/cancel.
    this.taskManager = options.taskManager || null
    // Newest first — initialize echoes the client's requested version when
    // supported, otherwise responds with the newest we support.
    this.supportedProtocolVersions = options.supportedProtocolVersions || [
      '2025-11-25',
      '2024-11-05'
    ]
  }

  registerTool (name, { description, inputSchema }, handler) {
    this.tools.set(name, { description, inputSchema, handler })
  }

  async connect (transport) {
    await transport.connect(this)
  }

  async close () {
    // nothing
  }
}

module.exports = { McpServer }

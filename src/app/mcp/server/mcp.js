class McpServer {
  constructor (options) {
    this.name = options.name
    this.version = options.version
    this.tools = new Map()
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

const { createServer } = require('node:http')
const { once } = require('node:events')

// Receive the same WebDAV requests as a sync destination, on an ephemeral
// loopback port. Retain raw bodies so the tests can inspect the wire format.
module.exports = async function startWebdav () {
  const files = new Map()
  const requests = []
  const server = createServer(async (req, res) => {
    requests.push({ method: req.method, url: req.url })
    if (req.method === 'PUT') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      files.set(req.url, Buffer.concat(chunks).toString())
      res.writeHead(201).end()
    } else if (req.method === 'GET' && files.has(req.url)) {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(files.get(req.url))
    } else {
      res.writeHead(req.method === 'MKCOL' ? 201 : 404).end()
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    files,
    requests,
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve))
  }
}

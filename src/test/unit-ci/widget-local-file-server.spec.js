/**
 * The built-in static file server used to serve os.homedir() with dotfiles
 * enabled and without looking at Host/Origin. A DNS-rebound page could read
 * ~/.ssh/id_rsa as same-origin. These tests exercise the real widget instance
 * over HTTP so the guard has to be wired into start(), not just exist as a
 * helper function.
 */

const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')

const { widgetRun } = require('../../app/widgets/widget-local-file-server')

let dir
let instance
let port

function request (urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: urlPath,
      method: 'GET',
      headers
    }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-static-server-'))
  fs.writeFileSync(path.join(dir, 'index.html'), 'hello from fixture')
  fs.mkdirSync(path.join(dir, '.ssh'))
  fs.writeFileSync(path.join(dir, '.ssh', 'id_rsa'), 'private key fixture')
  instance = widgetRun({ directory: dir, port: 0, host: '127.0.0.1' })
  const result = await instance.start()
  port = new URL(result.serverInfo.url).port
})

after(async () => {
  if (instance) {
    await instance.stop()
  }
  if (dir) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('serves a normal file with a loopback Host', async () => {
  const res = await request('/index.html', { Host: `127.0.0.1:${port}` })
  assert.equal(res.status, 200)
  assert.match(res.body, /hello from fixture/)
})

test('accepts other loopback spellings in Host', async () => {
  const res = await request('/index.html', { Host: `localhost:${port}` })
  assert.equal(res.status, 200)
})

test('rejects a rebound Host before serving anything', async () => {
  const res = await request('/index.html', { Host: `evil.example:${port}` })
  assert.equal(res.status, 403)
  assert.match(res.body, /invalid Host header/)
})

test('rejects any request carrying Origin', async () => {
  const res = await request('/index.html', {
    Host: `127.0.0.1:${port}`,
    Origin: `http://127.0.0.1:${port}`
  })
  assert.equal(res.status, 403)
  assert.match(res.body, /unexpected Origin header/)
})

test('dotfiles are denied by default', async () => {
  const res = await request('/.ssh/id_rsa', { Host: `127.0.0.1:${port}` })
  assert.ok(res.status === 403 || res.status === 404, `unexpected status ${res.status}`)
  assert.doesNotMatch(res.body, /private key fixture/)
})

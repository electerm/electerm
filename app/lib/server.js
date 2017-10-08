const express = require('express')
const app = express()
const cors = require('cors')
const pty = require('node-pty')
const {log} = require('./log')
const {resolve} = require('path')
const terminals = {}
const logs = {}
const staticPath = resolve(__dirname, '../static')
const pubPath = resolve(__dirname, '../assets')
const modPath = resolve(__dirname, '../node_modules')
app.use(cors())

require('express-ws')(app)

app.use('/', express.static(pubPath))
app.use('/_bc', express.static(modPath))
app.use('/static', express.static(staticPath))

app.post('/terminals', function (req, res) {
  let cols = parseInt(req.query.cols, 10)
  let rows = parseInt(req.query.rows, 10)
  let exe = process.platform === 'win32' ? 'cmd.exe' : 'bash'
  let term = pty.spawn(exe, [], {
    name: 'xterm-color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: process.env.PWD,
    env: process.env
  })
  let {pid} = term
  log('Created terminal with PID:', pid)
  terminals[pid] = term
  logs[pid] = ''
  term.on('data', function(data) {
    logs[term.pid] += data
  })
  res.send(term.pid.toString())
  res.end()
})

app.post('/terminals/:pid/size', function (req, res) {
  let pid = parseInt(req.params.pid)
  let cols = parseInt(req.query.cols, 10)
  let rows = parseInt(req.query.rows, 10)
  let term = terminals[pid]
  if (term) {
    term.resize(cols, rows)
    log('Resized terminal ', pid, ' to ', cols, ' cols and ', rows, ' rows.')
  }
  res.end()
})

app.ws('/terminals/:pid', function (ws, req) {
  let term = terminals[parseInt(req.params.pid)]
  let {pid} = term
  log('Connected to terminal', pid)

  ws.send(logs[term.pid])

  term.on('data', function(data) {
    try {
      ws.send(data)
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  })

  ws.on('message', function(msg) {
    term.write(msg)
  })

  ws.on('close', function () {
    term.kill()
    log('Closed terminal ' + term.pid)
    // Clean things up
    delete terminals[term.pid]
    delete logs[term.pid]
  })
})

module.exports = function({port, host, siteName}) {
  app.listen(port, host, () => {
    log(siteName, 'runs on', host, port)
  })
}

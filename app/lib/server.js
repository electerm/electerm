const express = require('express')
const app = express()
const cors = require('cors')
const {log} = require('./log')
const {resolve} = require('path')
const terminals = {}
const logs = {}
const pubPath = resolve(__dirname, '../assets')
const modPath = resolve(__dirname, '../node_modules')
const bodyParser = require('body-parser')
const {terminal} = require('./terminal')

app.use(cors())

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

require('express-ws')(app)

app.use(function (req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
})

app.use('/', express.static(pubPath))
app.use('/_bc', express.static(modPath))

app.post('/terminals', async function (req, res) {
  let body = JSON.parse(req.body.q)
  let term = await terminal(body)
    .then(r => r)
    .catch(err => err)
  let {pid} = term
  if (pid) {
    log('Created terminal with PID:', pid)
    terminals[pid] = term
    logs[pid] = ''
    term.on('data', function(data) {
      logs[pid] += data.toString()
    })
    res.end(pid)
  } else {
    res.status(500)
    res.end()
  }
})

app.post('/terminals/:pid/size', function (req, res) {
  let pid = req.params.pid
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
  let term = terminals[req.params.pid]
  let {pid} = term
  log('Connected to terminal', pid)

  ws.send(logs[pid])

  term.on('data', function(data) {
    try {
      ws.send(data.toString())
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  })

  ws.on('message', function(msg) {
    term.write(msg)
  })

  ws.on('close', function () {
    term.kill()
    log('Closed terminal ' + pid)
    // Clean things up
    delete terminals[pid]
    delete logs[pid]
  })
})

const runServer = function() {
  let {port, host} = process.env
  app.listen(port, host, () => {
    log('server', 'runs on', host, port)
  })
}

const quitServer = () => {
  Object.keys(terminals).forEach(k => {
    terminals[k].kill()
  })
}

process.on('exit', quitServer)

//start
runServer()



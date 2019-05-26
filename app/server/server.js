const express = require('express')
const app = express()
const cors = require('cors')
const log = require('../utils/log')
const terminals = {}
const logs = {}
const bodyParser = require('body-parser')
const { terminal } = require('./terminal')
const initWs = require('./dispatch-center')

app.use(cors())

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

require('express-ws')(app)

app.post('/terminals', async function (req, res) {
  let { body } = req
  let term = await terminal(body)
    .then(r => r)
    .catch(err => err)
  let { pid } = term
  if (pid) {
    log.debug('Created terminal with PID:', pid)
    terminals[pid] = term
    logs[pid] = Buffer.from('')
    term.on('data', function (data) {
      logs[pid] = Buffer.concat([
        logs[pid],
        Buffer.from(data)
      ])
    })
    res.end(pid)
  } else {
    res.status(500)
    res.end(term.stack)
  }
})

app.post('/terminals/:pid/size', function (req, res) {
  let pid = req.params.pid
  let cols = parseInt(req.query.cols, 10)
  let rows = parseInt(req.query.rows, 10)
  let term = terminals[pid]
  if (term) {
    term.resize(cols, rows)
    log.debug('Resized terminal ', pid, ' to ', cols, ' cols and ', rows, ' rows.')
  }
  res.end()
})

app.ws('/terminals/:pid', function (ws, req) {
  let term = terminals[req.params.pid]
  let { pid } = term
  log.debug('Connected to terminal', pid)

  ws.send(logs[pid])

  term.on('data', function (data) {
    try {
      ws.send(Buffer.from(data))
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  })

  function onClose () {
    term.kill()
    log.debug('Closed terminal ' + pid)
    // Clean things up
    delete terminals[pid]
    delete logs[pid]
    ws.close && ws.close()
  }

  term.on('close', onClose)

  ws.on('message', function (msg) {
    try {
      term.write(msg)
    } catch (ex) {
      log.error(ex)
    }
  })

  ws.on('error', log.error)

  ws.on('close', onClose)
})

app.get('/run', function (req, res) {
  res.send('ok')
})

initWs(app)

const runServer = function () {
  let { port, host } = process.env
  app.listen(port, host, () => {
    log.info('server', 'runs on', host, port)
  })
}

const quitServer = () => {
  Object.keys(terminals).forEach(k => {
    terminals[k].kill()
  })
}

process.on('exit', quitServer)

// start
runServer()

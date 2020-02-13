const express = require('express')
const app = express()
const cors = require('cors')
const log = require('../utils/log')
// const logs = {}
const bodyParser = require('body-parser')
const { terminal } = require('./session')
const initWs = require('./dispatch-center')
const {
  terminals
} = require('./remote-common')

app.use(cors())

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

require('express-ws')(app)

app.post('/terminals', async function (req, res) {
  const { body } = req
  const term = await terminal(body)
    .then(r => r)
    .catch(err => err)
  const { pid } = term
  if (pid) {
    log.debug('Created terminal with PID:', pid)
    // logs[pid] = Buffer.from('')
    // term.on('data', function (data) {
    //   logs[pid] = Buffer.concat([
    //     logs[pid],
    //     Buffer.from(data)
    //   ])
    // })
    res.end(pid)
  } else {
    res.status(500)
    res.end(term.stack)
  }
})

app.post('/terminals/:pid/size', function (req, res) {
  const pid = req.params.pid
  const { sessionId } = req.query
  const cols = parseInt(req.query.cols, 10)
  const rows = parseInt(req.query.rows, 10)
  const term = terminals(pid, sessionId)
  if (term) {
    term.resize(cols, rows)
    log.debug('Resized terminal ', pid, ' to ', cols, ' cols and ', rows, ' rows.')
  }
  res.end()
})

app.ws('/terminals/:pid', function (ws, req) {
  const { sessionId } = req.query
  const term = terminals(req.params.pid, sessionId)
  const { pid } = term
  log.debug('Connected to terminal', pid)

  ws.send('')

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
  const { electermPort, electermHost } = process.env
  app.listen(electermPort, electermHost, () => {
    log.info('server', 'runs on', electermHost, electermPort)
  })
}

const quitServer = () => {
  Object.keys(global.upgradeInsts).forEach(k => {
    const inst = global.upgradeInsts[k]
    inst && inst.destroy && inst.destroy()
  })
  Object.keys(global.sesssions).forEach(k => {
    const {
      terminals,
      sftps
    } = global.sesssions[k]
    sftps.forEach(s => {
      s.kill()
    })
    terminals.forEach(t => {
      t.kill()
    })
  })
}

process.on('exit', quitServer)

// start
runServer()

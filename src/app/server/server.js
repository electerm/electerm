const express = require('express')
const app = express()
const cors = require('cors')
const log = require('../utils/log')
// const logs = {}
const bodyParser = require('body-parser')
const { terminal, testConnection } = require('./session')
const initWs = require('./dispatch-center')
const {
  terminals
} = require('./remote-common')
const { token } = process.env

app.use(cors())

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

require('express-ws')(app)

function verify (req, res, next) {
  if (req.get('token') !== token) {
    throw new Error('not valid request')
  }
  next()
}

app.post('/terminals', verify, async function (req, res) {
  const { body } = req
  const { isTest } = req.query
  if (isTest) {
    const r = await testConnection(body)
    res.send(r)
    return
  }
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

app.post('/terminals/:pid/size', verify, function (req, res) {
  const pid = req.params.pid
  const { sessionId } = req.query
  const cols = parseInt(req.query.cols, 10)
  const rows = parseInt(req.query.rows, 10)
  const term = terminals(pid, sessionId)
  if (term) {
    term.resize(cols, rows)
  }
  res.end()
})

app.post('/terminals/:pid/run-cmd', verify, async function (req, res) {
  const pid = req.params.pid
  const { sessionId } = req.query
  const { cmd } = req.body
  const term = terminals(pid, sessionId)
  let txt = ''
  if (term) {
    txt = await term.runCmd(cmd)
  }
  res.end(txt)
})

app.ws('/terminals/:pid', function (ws, req) {
  const { sessionId, token: to } = req.query
  if (to !== token) {
    throw new Error('not valid request')
  }
  const term = terminals(req.params.pid, sessionId)
  const { pid } = term
  log.debug('ws: connected to terminal ->', pid)

  term.on('data', function (data) {
    try {
      if (term.sessionLogger) {
        term.sessionLogger.write(data)
      }
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

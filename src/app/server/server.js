const express = require('express')
const globalState = require('./global-state')
const app = express()
const log = require('../common/log')
const { verifyWs, initWs } = require('./dispatch-center')
const {
  terminals
} = require('./remote-common')
const {
  isWin,
  isDev
} = require('../common/runtime-constants')
const initFileServer = require('../lib/file-server')

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }))

// parse application/json
app.use(express.json())

require('express-ws')(app, undefined, {
  wsOptions: {
    perMessageDeflate: {
      zlibDeflateOptions: {
        // See zlib defaults.
        chunkSize: 1024 * 8,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Other options settable:
      clientNoContextTakeover: true, // Defaults to negotiated value.
      serverNoContextTakeover: true, // Defaults to negotiated value.
      serverMaxWindowBits: 10, // Defaults to negotiated value.
      // Below options specified as default values.
      concurrencyLimit: 10, // Limits zlib concurrency for perf.
      threshold: 1024 * 8 // Size (in bytes) below which messages
      // should not be compressed.
    }
  }
})

app.ws('/terminals/:pid', function (ws, req) {
  const { sessionId } = req.query
  verifyWs(req)
  const term = terminals(req.params.pid, sessionId)
  const { pid } = term
  log.debug('ws: connected to terminal ->', pid)

  term.on('data', function (data) {
    try {
      term.writeLog(data)
      ws.send(Buffer.from(data))
    } catch (ex) {
      console.log(ex)
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
  if (term.isLocal && isWin) {
    term.on('exit', onClose)
  }

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

app.ws('/rdp/:pid', function (ws, req) {
  const { sessionId, width, height } = req.query
  verifyWs(req)
  const term = terminals(req.params.pid, sessionId)
  term.ws = ws
  term.start(width, height)
  const { pid } = term
  log.debug('ws: connected to rdp session ->', pid)
  ws.on('error', log.error)
})

app.ws('/vnc/:pid', function (ws, req) {
  const { sessionId, ...rest } = req.query
  verifyWs(req)
  const term = terminals(req.params.pid, sessionId)
  term.ws = ws
  term.start(rest)
  const { pid } = term
  log.debug('ws: connected to vnc session ->', pid)
  ws.on('error', log.error)
})

app.get('/run', function (req, res) {
  res.send('ok')
})
app.post('/auth', function (req, res) {
  const { token } = req.body
  if (token === process.env.requireAuth) {
    globalState.authed = true
  }
  res.send('ok')
})
if (!isDev) {
  initFileServer(app)
}
initWs(app)

const runServer = function () {
  const { electermPort, electermHost } = process.env
  app.listen(electermPort, electermHost, () => {
    log.info('server', 'runs on', electermHost, electermPort)
    process.send({ serverInited: true })
  })
}

// start
runServer()

process.on('uncaughtException', (err) => {
  log.error('uncaughtException', err)
})
process.on('unhandledRejection', (err) => {
  log.error('unhandledRejection', err)
})

process.on('SIGTERM', () => {
  process.exit(0)
})

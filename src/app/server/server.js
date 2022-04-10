const express = require('express')
const app = express()
const cors = require('cors')
const strip = require('@electerm/strip-ansi').default
const log = require('../common/log')
// const logs = {}
const bodyParser = require('body-parser')
const { verifyWs, initWs } = require('./dispatch-center')
const {
  terminals
} = require('./remote-common')
app.use(cors())

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

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
      if (term.sessionLogger) {
        term.sessionLogger.write(strip(data.toString()))
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
    process.send({ serverInited: true })
  })
}

// start
runServer()

const express = require('express')
const globalState = require('./global-state')
const app = express()
const log = require('../common/log')
const { initWs } = require('./dispatch-center')
const {
  isDev
} = require('../common/runtime-constants')
const initFileServer = require('../lib/file-server')
const appDec = require('./app-wrap')

appDec(app)

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
  const onError = (err) => {
    log.error('server', 'failed to listen on', `${electermHost}:${electermPort}`, err.message)
    try {
      process.send({
        serverInited: false,
        error: { message: err.message, code: err.code }
      })
    } catch (e) {}
    setTimeout(() => process.exit(1), 100)
  }
  const server = app.listen(electermPort, electermHost, () => {
    log.info('server', 'runs on', electermHost, electermPort)
    process.send({ serverInited: true })
  })
  // Without this a port failure only surfaced as an uncaughtException: the
  // main process kept waiting for serverInited and no window ever appeared.
  // express-ws re-emits the http server's errors on its WebSocketServer, and
  // an unhandled 'error' there throws before this listener runs, so both get one.
  server.on('error', onError)
  const wss = app.getWss && app.getWss()
  if (wss) {
    wss.on('error', onError)
  }
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

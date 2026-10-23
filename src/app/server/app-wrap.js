const express = require('express')

module.exports = function (app) {
  // parse application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: false }))

  // parse application/json
  app.use(express.json())

  const wsInstance = require('express-ws')(app, undefined, {
    wsOptions: {
      perMessageDeflate: false
    }
  })
  // `ws` re-emits the http server's listen errors on its WebSocketServer, and an
  // unhandled 'error' event there throws before the http server's own 'error'
  // listener gets a chance to run. Keep the instance reachable so a failed
  // listen can be handled instead of turning into an uncaughtException.
  app.getWss = wsInstance.getWss
  return wsInstance
}

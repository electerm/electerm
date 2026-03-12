const express = require('express')

module.exports = function (app) {
  // parse application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: false }))

  // parse application/json
  app.use(express.json())

  require('express-ws')(app, undefined, {
    wsOptions: {
      perMessageDeflate: false
    }
  })
}

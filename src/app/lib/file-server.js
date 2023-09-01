const express = require('express')

module.exports = (port) => {
  return new Promise((resolve) => {
    const app = express()
    const conf = {
      maxAge: 1000 * 60 * 60 * 24 * 365
    }
    app.use(
      express.static(
        require('path').resolve(__dirname, '../assets'),
        conf
      )
    )
    app.listen(port, '127.0.0.1', resolve)
  })
}

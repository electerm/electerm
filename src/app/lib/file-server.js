const express = require('express')

module.exports = () => {
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
    app.use(
      '/node_modules',
      express.static(
        require('path').resolve(__dirname, '../node_modules'),
        conf
      )
    )
    const { devPort = 5571 } = process.env
    app.listen(devPort, '127.0.0.1', resolve)
  })
}

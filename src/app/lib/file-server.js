const express = require('express')

module.exports = () => {
  return new Promise((resolve) => {
    const app = express()
    app.use(
      express.static(
        require('path').resolve(__dirname, '../assets')
      )
    )
    app.use(
      '/node_modules',
      express.static(
        require('path').resolve(__dirname, '../node_modules')
      )
    )
    const { devPort = 5571 } = process.env
    app.listen(devPort, '127.0.0.1', resolve)
  })
}

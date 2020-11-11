const express = require('express')
const path = require('path')
const { env } = process
const devPort = env.devPort || 5570
const host = env.host || '127.0.0.1'

module.exports = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
  },
  contentBase: path.join(__dirname, '../work/app/assets/'),
  historyApiFallback: true,
  hot: true,
  inline: true,
  host,
  port: devPort,
  before: (app) => {
    app.use('/node_modules', express.static(
      path.resolve(__dirname, '../node_modules'), { maxAge: '170d' })
    )
    app.use('/less', express.static(
      path.resolve(__dirname, '../src/client/css'), { maxAge: '170d' })
    )
  }
}

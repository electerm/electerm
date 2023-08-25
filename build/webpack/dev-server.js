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
  historyApiFallback: true,
  hot: true,
  host,
  port: devPort,
  onBeforeSetupMiddleware: (devServer) => {
    devServer.app.use('/node_modules', express.static(
      path.resolve(__dirname, '../../node_modules'), { maxAge: '170d' })
    )
  }
}

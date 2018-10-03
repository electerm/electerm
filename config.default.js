const os = require('os')
const extend = require('recursive-assign')
let config = {

  site: {

    env: process.env.NODE_ENV || 'development',

    siteName: 'electerm'

  },

  test: false,
  host: '0.0.0.0',
  port: process.env.PORT || 4570,
  devCPUCount: os.cpus().length,
  pkg: require('./package'),
  devPort: 5570
}

try {
  extend(config, require('./config.js'))
} catch (e) {
  if (!e.stack.includes('Cannot find module \'./config.js\'')) {
    console.log (e.stack)
  }
}

module.exports = config




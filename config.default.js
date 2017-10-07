const os = require('os')
const extend = require('recursive-assign')
let config = {

  site: {

    env: process.env.NODE_ENV || 'development',

    siteName: 'essh page server'

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
  console.log(e.stack)
  console.warn('warn:no custom config file, use "cp config.sample.js config.js" to create one')
}

module.exports = config




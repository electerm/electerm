
const { happy } = require('./happy-pack')
const copy = require('./copy')
const {
  extractTextPlugin1,
  stylusSettingPlugin
} = require('./plugins')
module.exports = (config) => {
  config.plugins = [
    happy,
    extractTextPlugin1,
    stylusSettingPlugin,
    copy
  ]
  config.optimization = {
    minimize: true
  }
  config.mode = 'production'
  delete config.watch
  delete config.devtool
  delete config.devServer
  return config
}


const { happy } = require('./happy-pack')
const copy = require('./copy')
const TerserPlugin = require('terser-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
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
    minimize: true,
    minimizer: [
      new TerserPlugin(),
      new CssMinimizerPlugin()
    ]
  }
  config.mode = 'production'
  delete config.watch
  delete config.devtool
  delete config.devServer
  return config
}

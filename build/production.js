
const copy = require('./copy')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const AntdDayjsWebpackPlugin = require('antd-dayjs-webpack-plugin')
const {
  extractTextPlugin1,
  stylusSettingPlugin
} = require('./plugins')
module.exports = (config) => {
  config.plugins = [
    extractTextPlugin1,
    stylusSettingPlugin,
    new AntdDayjsWebpackPlugin(),
    copy
  ]
  config.optimization = {
    // splitChunks: {
    //   chunks: 'all',
    //   maxInitialRequests: Infinity,
    //   minSize: 200000,
    //   cacheGroups: {
    //     vendor: {
    //       test: /[\\/]node_modules[\\/]/,
    //       name (module) {
    //         // get the name. E.g. node_modules/packageName/not/this/part.js
    //         // or node_modules/packageName
    //         const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1]

    //         // npm package names are URL-safe, but some servers don't like @ symbols
    //         return `npm.${packageName.replace('@', '')}`
    //       }
    //     }
    //   }
    // },
    minimize: true,
    minimizer: [
      new CssMinimizerPlugin(),
      '...'
    ]
  }
  config.mode = 'production'
  delete config.watch
  delete config.devtool
  delete config.devServer
  return config
}

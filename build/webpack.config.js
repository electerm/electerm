require('dotenv').config()
const webpack = require('webpack')
const { identity } = require('lodash')
const path = require('path')
const { env, version } = require('./common')
const isProd = env === 'production'
const {
  extractTextPlugin1,
  stylusSettingPlugin
} = require('./plugins')
const devServer = require('./dev-server')
const rules = require('./rules')
const prod = require('./production')

let config = {
  mode: 'development',
  entry: {
    electerm: './src/client/entry/index.jsx',
    basic: './src/client/entry/basic.jsx',
    index: './src/views/index.pug'
  },
  output: {
    path: path.resolve(__dirname, '../work/app/assets'),
    filename: 'js/[name].' + version + '.js',
    publicPath: '/',
    chunkFilename: 'js/[name].' + version + '.js',
    libraryTarget: 'var',
    library: 'Et'
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    lodash: '_'
  },
  target: 'es7',
  watch: true,
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.json'],
    alias: {
      client: path.resolve(__dirname, '../src/client'),
      node_modules: path.resolve(__dirname, '../node_modules'),
      'app-common': path.resolve(__dirname, '../src/app/common')
    }
  },
  resolveLoader: {
    modules: [
      path.resolve(__dirname, '../src/client/loaders'),
      path.join(process.cwd(), 'node_modules')
    ]
  },
  module: {
    rules
  },
  devtool: 'source-map',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    stylusSettingPlugin,
    extractTextPlugin1
  ].filter(identity),
  devServer
}

if (isProd) {
  config = prod(config)
}

module.exports = config

require('dotenv').config()
const webpack = require('webpack')
const os = require('os')
const {identity} = require('lodash')
const MinifyPlugin = require('babel-minify-webpack-plugin')
const HappyPack = require('happypack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const express = require('express')
const path = require('path')
const pack = require('./package.json')
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const {env} = process
const git = require('git-rev-sync')
const packThreadCount = env.packThreadCount
  ? parseInt(env.packThreadCount)
  : os.cpus().length
const devPort = env.devPort || 5570
const host = env.host || 'localhost'
const happyThreadPool = packThreadCount === 0
  ? null
  : HappyPack.ThreadPool({ size: packThreadCount })

const happyConf = {
  loaders: ['babel-loader'],
  threadPool: happyThreadPool,
  verbose: true
}
let version = pack.version + '-' + git.long()
let isProd = env.NODE_ENV === 'production'
const extractTextPlugin1 = new MiniCssExtractPlugin({
  filename: 'css/[name].styles.css'
})
const pug = {
  loader: 'pug-html-loader',
  options: {
    data: {
      version,
      _global: {
        version
      }
    }
  }
}
const stylusSettingPlugin =  new webpack.LoaderOptionsPlugin({
  test: /\.styl$/,
  stylus: {
    preferPathResolver: 'webpack'
  },
  'resolve url': false
})

var config = {
  mode: 'development',
  entry: {
    electerm: './src/client/entry/index.jsx',
    basic: './src/client/entry/basic.jsx',
    index: './src/views/index.pug'
  },
  output: {
    path: __dirname + '/app/assets',
    filename: 'js/[name].' + version + '.js',
    publicPath: '/',
    chunkFilename: 'js/[name].' + version + '.js',
    libraryTarget: 'var'
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
  },
  watch: true,
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.json'],
    alias: {
      'client': path.resolve(__dirname, 'src/client'),
      'node_modules': path.resolve(__dirname, 'node_modules')
    }
  },
  resolveLoader: {
    modules: [
      path.resolve(__dirname, 'src/client/loaders'),
      path.join(process.cwd(), 'node_modules')
    ]
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: [packThreadCount === 0 ? 'babel-loader?cacheDirectory' : 'happypack/loader?cacheDirectory']
      },
      {
        test: /\.styl$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              // you can specify a publicPath here
              // by default it use publicPath in webpackOptions.output
              publicPath: '../'
            }
          },
          'css-loader',
          'stylus-loader'
        ]
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              // you can specify a publicPath here
              // by default it use publicPath in webpackOptions.output
              publicPath: '../'
            }
          },
          {
            loader: 'css-loader'
          },
          {
            loader: 'less-loader',
            options: {
              javascriptEnabled: true,
              modifyVars: {
                'border-radius-base': '3px'
              }
            }
          }
        ]
      },
      {
        test: /xterm\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              // you can specify a publicPath here
              // by default it use publicPath in webpackOptions.output
              publicPath: '../'
            }
          },
          'css-loader'
        ]
      },
      {
        test: /\.(png|jpg|svg)$/,
        use: ['url-loader?limit=1&name=images/[name].[ext]']
      },
      {
        test: /\.pug$/,
        use: [
          'file-loader?name=index.html',
          'concat-loader',
          'extract-loader',
          'html-loader',
          pug
        ]
      }
    ]
  },
  optimization: {
    minimizer: [
      new OptimizeCSSAssetsPlugin({})
    ]
  },
  devtool: '#eval-source-map',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new LodashModuleReplacementPlugin(),
    stylusSettingPlugin,
    packThreadCount === 0 ? null : new HappyPack(happyConf),
    extractTextPlugin1
  ].filter(identity),
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
    },
    contentBase: path.join(__dirname, 'app/assets/'),
    historyApiFallback: true,
    hot: true,
    inline: true,
    host,
    port: devPort,
    before: (app) => {
      app.use('/node_modules', express.static(
        path.resolve(__dirname, './node_modules'), {maxAge: '170d'})
      )
    }
  }
}

if (isProd) {
  config.plugins = [
    packThreadCount === 0 ? null : new HappyPack(happyConf),
    //new webpack.optimize.DedupePlugin(),
    // commonsChunkPlugin,
    // new webpack.optimize.CommonsChunkPlugin({
    //   name: 'manifest',
    //   minChunks: Infinity
    // }),
    extractTextPlugin1,
    stylusSettingPlugin,
    new LodashModuleReplacementPlugin(),
    //new webpack.optimize.OccurenceOrderPlugin(),
    // new webpack.optimize.MinChunkSizePlugin({
    //   minChunkSize: 51200 // ~50kb
    // }),
    new MinifyPlugin()
  ]
  config.mode = 'production'
  delete config.watch
  delete config.devtool
  delete config.devServer
}

module.exports = config


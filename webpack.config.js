require('dotenv').config()
const webpack = require('webpack')
const os = require('os')
const { identity } = require('lodash')
const HappyPack = require('happypack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const express = require('express')
const path = require('path')
const pack = require('./package.json')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const { env } = process
const git = require('git-rev-sync')
const packThreadCount = env.packThreadCount
  ? parseInt(env.packThreadCount)
  : os.cpus().length
const devPort = env.devPort || 5570
const host = env.host || 'localhost'
const theme = require('@ant-design/dark-theme').default
const happyThreadPool = packThreadCount === 0
  ? null
  : HappyPack.ThreadPool({ size: packThreadCount })

const happyConf = {
  loaders: ['babel-loader'],
  threadPool: happyThreadPool,
  verbose: true
}
const version = pack.version + '-' + git.long()
const isProd = env.NODE_ENV === 'production'
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
const stylusSettingPlugin = new webpack.LoaderOptionsPlugin({
  test: /\.styl$/,
  stylus: {
    preferPathResolver: 'webpack'
  },
  'resolve url': false
})
const from = path.resolve(
  __dirname,
  'node_modules/@electerm/electerm-resource/tray-icons'
)
const to1 = path.resolve(
  __dirname,
  'work/app/assets/images'
)
var config = {
  mode: 'development',
  entry: {
    electerm: './src/client/entry/index.jsx',
    basic: './src/client/entry/basic.jsx',
    index: './src/views/index.pug'
  },
  output: {
    path: path.resolve(__dirname, 'work/app/assets'),
    filename: 'js/[name].' + version + '.js',
    publicPath: '/',
    chunkFilename: 'js/[name].' + version + '.js',
    libraryTarget: 'var'
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    zmodem: 'Zmodem',
    lodash: '_'
  },
  target: 'electron-renderer',
  watch: true,
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.json'],
    alias: {
      client: path.resolve(__dirname, 'src/client'),
      node_modules: path.resolve(__dirname, 'node_modules'),
      'app-common': path.resolve(__dirname, 'src/app/common')
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
              modifyVars: theme
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
    stylusSettingPlugin,
    packThreadCount === 0 ? null : new HappyPack(happyConf),
    extractTextPlugin1
  ].filter(identity),
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
    },
    contentBase: path.join(__dirname, 'work/app/assets/'),
    historyApiFallback: true,
    hot: true,
    inline: true,
    host,
    port: devPort,
    before: (app) => {
      app.use('/node_modules', express.static(
        path.resolve(__dirname, './node_modules'), { maxAge: '170d' })
      )
    }
  }
}

if (isProd) {
  config.plugins = [
    packThreadCount === 0 ? null : new HappyPack(happyConf),
    extractTextPlugin1,
    stylusSettingPlugin,
    new CopyWebpackPlugin({
      patterns: [{
        from,
        to: to1,
        force: true
      }]
    })
  ]
  config.optimization = {
    minimize: true
  }
  config.mode = 'production'
  delete config.watch
  delete config.devtool
  delete config.devServer
}

module.exports = config

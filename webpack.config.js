
const webpack = require('webpack')
const {identity} = require('lodash')
const sysConfigDefault = require('./src/server/config')
const packThreadCount = sysConfigDefault.devCPUCount // number
const BabiliPlugin = require('babili-webpack-plugin')
const HappyPack = require('happypack')
const happyThreadPool = packThreadCount === 0 ? null : HappyPack.ThreadPool({ size: packThreadCount })
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const path = require('path')
const env = process.env.NODE_ENV
const happyConf = {
  loaders: ['babel-loader'],
  threadPool: happyThreadPool,
  verbose: true
}
// const commonsChunkPlugin = new webpack.optimize.CommonsChunkPlugin({
//   // name: 'vender', // Move dependencies to our vender file
//   children: true, // Look for common dependencies in all children,
//   async: true,
//   minChunks: 2 // How many times a dependency must come up before being extracted
// })

const extractTextPlugin = new ExtractTextPlugin({
  filename: 'css/[name].styles.css'
})
const stylusSettingPlugin =  new webpack.LoaderOptionsPlugin({
  test: /\.styl$/,
  stylus: {
    preferPathResolver: 'webpack'
  }
})

var config = {
  entry: {
    essh: './src/client/entry/index.jsx',
    'common-css': './src/client/entry/common-css.jsx'
  },
  output: {
    path: __dirname + '/app/assets', // 输出文件目录
    filename: 'js/[name].bundle.js', // 输出文件名
    publicPath: '/',
    chunkFilename: 'js/[id].[name].[hash].bundle.js',
    libraryTarget: 'var'
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM',
    'moment': 'moment',
    'crypto-js': 'CryptoJS',
    'lodash': '_'
  },
  watch: true,
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.json'],
    alias: {
      'client': path.resolve(__dirname, 'src/client')
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
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          publicPath: '../',
          use: ['css-loader', 'stylus-loader']
        })
      },
      {
        test: /antd\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          publicPath: '../',
          use: ['antd-icon-fix', 'css-loader']
        })
      },
      {
        test: /\.(png|jpg|svg)$/,
        use: ['url-loader?limit=10192&name=images/[hash].[ext]']
      }
    ]
  },
  devtool: '#eval-source-map',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    //commonsChunkPlugin,
    stylusSettingPlugin,
    packThreadCount === 0 ? null : new HappyPack(happyConf),
    extractTextPlugin
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
    host: '0.0.0.0',
    port: sysConfigDefault.devPort,
    proxy: {
      '*': {
        target: 'http://localhost:' + sysConfigDefault.port,
        secure: false,
        ws: false,
        bypass: function (req) {
          let pth = req.path
          if (
            (
              /(\.json|\.jpg|\.png|\.css)$/.test(pth) &&
              !/^\/static\//.test(pth) &&
              !/^\/_bc\//.test(pth)
            ) ||
            /\.bundle\.js/.test(pth)
          ) {
            console.log('bypass', pth)
            return req.path
          }
        }
      }
    }
  }
}

if (env === 'production') {
  config.plugins = [
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': '\'production\''
      }
    }),
    packThreadCount === 0 ? null : new HappyPack(happyConf),
    //new webpack.optimize.DedupePlugin(),
    // commonsChunkPlugin,
    // new webpack.optimize.CommonsChunkPlugin({
    //   name: 'manifest',
    //   minChunks: Infinity
    // }),
    extractTextPlugin,
    stylusSettingPlugin,
    //new webpack.optimize.OccurenceOrderPlugin(),
    // new webpack.optimize.MinChunkSizePlugin({
    //   minChunkSize: 51200 // ~50kb
    // }),
    new BabiliPlugin()
  ]

  delete config.watch
  delete config.devtool
  delete config.devServer
}

module.exports = config


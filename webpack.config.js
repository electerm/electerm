
const webpack = require('webpack')
const {identity} = require('lodash')
const sysConfigDefault = require('./src/server/config')
const packThreadCount = sysConfigDefault.devCPUCount // number
const BabiliPlugin = require('babili-webpack-plugin')
const HappyPack = require('happypack')
const happyThreadPool = packThreadCount === 0 ? null : HappyPack.ThreadPool({ size: packThreadCount })
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const path = require('path')
const pack = require('./package.json')
const env = process.env.NODE_ENV
const happyConf = {
  loaders: ['babel-loader'],
  threadPool: happyThreadPool,
  verbose: true
}
let version = pack.version + '-' + (+new Date())
if (env === 'production') {
  try {
    version = require('fs').readFileSync('./version').toString()
  } catch(e) {
    //
    console.log(e)
  }
}

const extractTextPlugin1 = new ExtractTextPlugin({
  filename: 'css/[name].styles.css'
})
const extractTextPlugin2 = new ExtractTextPlugin({
  filename: 'index.html'
})

const pug = {
  loader: 'pug-html-loader',
  options: {
    data: {
      version,
      _global: {}
    }
  }
}

const stylusSettingPlugin =  new webpack.LoaderOptionsPlugin({
  test: /\.styl$/,
  stylus: {
    preferPathResolver: 'webpack'
  }
})

var config = {
  mode: 'development',
  entry: {
    essh: './src/client/entry/index.jsx',
    index: './src/views/index.pug'
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
        use: extractTextPlugin1.extract({
          fallback: 'style-loader',
          publicPath: '../',
          use: ['css-loader', 'stylus-loader']
        })
      },
      {
        test: /\.less$/,
        use: extractTextPlugin1.extract({
          fallback: 'style-loader',
          publicPath: '../',
          use: [
            {
              loader: 'antd-icon-loader',
              options: {

                //relative path to your css path
                path: '../../_bc/electerm-resource/res/fonts',

                //version, will add to icon source url to help clear cache
                version: '13212sdf'
              }
            },
            {
              loader: 'css-loader'
            },
            {
              loader: 'less-loader',
              options: {
                javascriptEnabled: true
              }
            }
          ]
        })
      },
      {
        test: /xterm\.css$/,
        use: extractTextPlugin1.extract({
          fallback: 'style-loader',
          publicPath: '../',
          use: ['css-loader']
        })
      },
      {
        test: /\.(png|jpg|svg)$/,
        use: ['url-loader?limit=10192&name=images/[hash].[ext]']
      },
      {
        test: /\.pug$/,
        use: [
          'file-loader?name=index.html',
          {
            loader: 'extract-loader',
            options: {
              publicPath: ''
            }
          },
          'html-loader',
          pug
        ]
      }
    ]
  },
  devtool: '#eval-source-map',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    //commonsChunkPlugin,
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
        'NODE_ENV': JSON.stringify('production')
      }
    }),
    packThreadCount === 0 ? null : new HappyPack(happyConf),
    //new webpack.optimize.DedupePlugin(),
    // commonsChunkPlugin,
    // new webpack.optimize.CommonsChunkPlugin({
    //   name: 'manifest',
    //   minChunks: Infinity
    // }),
    extractTextPlugin1,
    extractTextPlugin2,
    stylusSettingPlugin,
    //new webpack.optimize.OccurenceOrderPlugin(),
    // new webpack.optimize.MinChunkSizePlugin({
    //   minChunkSize: 51200 // ~50kb
    // }),
    new BabiliPlugin()
  ]
  config.mode = 'production'
  delete config.watch
  delete config.devtool
  delete config.devServer
}

module.exports = config


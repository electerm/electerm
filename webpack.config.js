
const webpack = require('webpack')
const {identity} = require('lodash')
const sysConfigDefault = require('./src/server/config')
const packThreadCount = sysConfigDefault.devCPUCount // number
const MinifyPlugin = require('babel-minify-webpack-plugin')
const HappyPack = require('happypack')
const happyThreadPool = packThreadCount === 0 ? null : HappyPack.ThreadPool({ size: packThreadCount })
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const path = require('path')
const pack = require('./package.json')
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const env = process.env.NODE_ENV
const git = require('git-rev-sync')

const happyConf = {
  loaders: ['babel-loader'],
  threadPool: happyThreadPool,
  verbose: true
}
let version = pack.version + '-' + git.long()

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
  }
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
              javascriptEnabled: true
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
        use: ['url-loader?limit=10192&name=images/[hash].[ext]']
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
    //commonsChunkPlugin,
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


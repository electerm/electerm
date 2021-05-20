const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const pug = require('./pug')
module.exports = [
  {
    test: /\.jsx?$/,
    exclude: /node_modules/,
    use: ['babel-loader?cacheDirectory']
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
    use: 'null-loader'
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
      {
        loader: 'html-loader',
        options: {
          sources: false
        }
      },
      pug
    ]
  }
]

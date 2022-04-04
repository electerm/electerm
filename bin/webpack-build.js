const { exec } = require('shelljs')
const { resolve } = require('path')
// ./node_modules/.bin/cross-env NODE_ENV=production ./node_modules/.bin/webpack --progress --config build/webpack.config.js"
const webpack = resolve(
  __dirname, '../node_modules/.bin/webpack'
)
const conf = resolve(
  __dirname,
  '../build/webpack.config.js'
)
exec(`NODE_ENV=production ${webpack} --progress --config ${conf}`)

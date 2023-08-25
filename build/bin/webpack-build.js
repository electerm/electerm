const { exec } = require('shelljs')
const { resolve } = require('path')
// ./node_modules/.bin/cross-env NODE_ENV=production ./node_modules/.bin/webpack --progress --config build/webpack.config.js"
const webpack = resolve(
  __dirname, '../../node_modules/.bin/webpack'
)
const crossEnv = resolve(
  __dirname, '../../node_modules/.bin/cross-env'
)
const conf = resolve(
  __dirname,
  '../webpack/webpack.config.js'
)
exec(`${crossEnv} NODE_ENV=production ${webpack} --progress --config ${conf}`)


const { env, version, ga } = require('./common')
const { loadDevStylus } = require('./style')
const copy = require('json-deep-copy')
const base = {
  env,
  version,
  stylus: loadDevStylus(),
  ga
}
module.exports = {
  loader: '@electerm/pug-html-loader',
  options: {
    data: {
      ...base,
      _global: copy(base)
    }
  }
}

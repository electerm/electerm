
const { env, version } = require('./common')
const { loadDevStylus } = require('./style')
const copy = require('json-deep-copy')
const base = {
  env,
  version,
  stylus: loadDevStylus()
}
module.exports = {
  loader: 'pug-html-loader',
  options: {
    data: {
      ...base,
      _global: copy(base)
    }
  }
}

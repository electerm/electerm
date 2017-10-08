const _ = require('lodash')

const logParser = arg => {
  return _.isArray(arg) || _.isPlainObject(arg)
    ? JSON.stringify(arg, null, 2)
    : arg
}

function log (...args) {
  console.log('' + new Date(), ...args.map(logParser))
}

function err (...args) {
  console.log('' + new Date(), ...args.map(logParser))
}

module.exports = {
  log,
  err
}

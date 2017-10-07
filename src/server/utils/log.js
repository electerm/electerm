import config from '../config'
import {blue, red, yellow} from 'chalk'
import _ from 'lodash'

export function debugLog (env) {
  console.log('env:', env)
  return function (...args) {
    if (config.site.env === env) console.log(...args.map(arg => {
      return _.isArray(arg) || _.isObject(arg)
        ? JSON.stringify(arg, null, 2)
        : arg
    }))
  }
}

export const debug = debugLog('development')

global.debug = debug

export function log (...args) {
  console.log(blue('' + new Date(), ...args))
}

export function err (...args) {
  console.log(red('' + new Date(), ...args))
}

export function warn (...args) {
  console.log(yellow('' + new Date(), ...args.map(function (v) {
    return v.stack || v
  })))
}

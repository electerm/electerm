/**
 * fs through ws
 */
import fetch from './fetch-from-server'

const { fsFunctions } = window.pre

export default fsFunctions.reduce((prev, func) => {
  prev[func] = (...args) => {
    return fetch({
      action: 'fs',
      args,
      func
    })
  }
  return prev
}, {})

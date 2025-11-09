/**
 * Simple lodash replacement with only the functions needed by the app
 * This replaces the full lodash library to reduce bundle size
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
function debounce (func, wait, immediate) {
  let timeout
  return function executedFunction (...args) {
    const later = () => {
      timeout = null
      if (!immediate) func.apply(this, args)
    }
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func.apply(this, args)
  }
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 */
function throttle (func, wait, options = {}) {
  let timeout
  let previous = 0

  const later = function () {
    previous = options.leading === false ? 0 : Date.now()
    timeout = null
    func.apply(this, arguments)
  }

  return function throttled (...args) {
    const now = Date.now()
    if (!previous && options.leading === false) previous = now
    const remaining = wait - (now - previous)

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      func.apply(this, args)
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(() => later.apply(this, args), remaining)
    }
  }
}

/**
 * Creates an object composed of the picked object properties.
 */
function pick (object, paths) {
  const result = {}
  const keys = Array.isArray(paths) ? paths : [paths]

  for (const key of keys) {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      result[key] = object[key]
    }
  }

  return result
}

/**
 * Checks if value is an empty object, collection, map, or set.
 */
function isEmpty (value) {
  if (value == null) {
    return true
  }

  if (Array.isArray(value) || typeof value === 'string') {
    return value.length === 0
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0
  }

  return false
}

/**
 * Checks if value is classified as an Array object.
 */
function isArray (value) {
  return Array.isArray(value)
}

/**
 * Checks if value is classified as a Function object.
 */
function isFunction (value) {
  return typeof value === 'function'
}

module.exports = {
  debounce,
  throttle,
  pick,
  isEmpty,
  isArray,
  isFunction
}

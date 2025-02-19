// expect.js
const { expect: playwrightExpect } = require('@playwright/test')

function extend (value) {
  const originalExpect = playwrightExpect(value)

  // Create a proxy to handle all method calls
  return new Proxy(originalExpect, {
    get (target, prop) {
      // Handle the five custom functions
      if (prop === 'equal' || prop === 'equals') {
        return (expected) => target.toEqual(expected)
      }
      if (prop === 'lessThan') {
        return (expected) => target.toBeLessThan(expected)
      }
      if (prop === 'greaterThan') {
        return (expected) => target.toBeGreaterThan(expected)
      }
      if (prop === 'includes') {
        return (expected) => target.toContain(expected)
      }

      // For all other properties, return the original Playwright expect method
      return target[prop]
    }
  })
}

// Export a function that looks like Chai's expect
module.exports = {
  expect: (actual) => extend(actual)
}

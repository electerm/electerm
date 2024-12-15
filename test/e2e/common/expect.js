// expect.js
const { expect: playwrightExpect } = require('@playwright/test')

function extend (value) {
  const originalExpect = playwrightExpect(value)

  return {
    // Maintain Chai's equal/equals syntax
    equal (expected) {
      return originalExpect.toEqual(expected)
    },
    equals (expected) {
      return originalExpect.toEqual(expected)
    },

    // Common Chai length checks
    lessThan (expected) {
      return originalExpect.toBeLessThan(expected)
    },
    greaterThan (expected) {
      return originalExpect.toBeGreaterThan(expected)
    },

    // Chai's includes
    includes (expected) {
      return originalExpect.toContain(expected)
    }
  }
}

// Export a function that looks like Chai's expect
module.exports = {
  expect: (actual) => extend(actual)
}

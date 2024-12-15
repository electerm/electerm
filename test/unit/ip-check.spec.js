const { expect } = require('../common/expect')
const {
  test: it
} = require('@playwright/test')
const { describe } = it
it.setTimeout(100000)

function isValidIP (input) {
  // Check IPv4 format
  const ipv4Pattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (ipv4Pattern.test(input)) {
    return true
  }

  // Check IPv6 format
  const ipv6Pattern = /^([\da-f]{1,4}:){7}[\da-f]{1,4}$/i
  if (ipv6Pattern.test(input)) {
    return true
  }

  // If input doesn't match IPv4 or IPv6 patterns, it's not a valid IP
  return false
}

describe('isValidIP', () => {
  it('should return true for valid IPv4 addresses', () => {
    expect(isValidIP('192.168.0.1')).toBe(true)
    expect(isValidIP('10.0.0.1')).toBe(true)
    expect(isValidIP('172.16.0.1')).toBe(true)
  })

  it('should return true for valid IPv6 addresses', () => {
    expect(isValidIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
    expect(isValidIP('2001:db8:85a3:0:0:8a2e:370:7334')).toBe(true)
    expect(isValidIP('2001:db8:85a3::8a2e:370:7334')).toBe(true)
  })

  it('should return false for invalid IP addresses', () => {
    expect(isValidIP('192.168.0.256')).toBe(false)
    expect(isValidIP('2001:db8:85a3:0:0:8a2e:370g:7334')).toBe(false)
    expect(isValidIP('not-an-ip-address')).toBe(false)
  })
})

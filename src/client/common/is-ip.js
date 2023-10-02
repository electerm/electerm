export function isValidIP (input) {
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

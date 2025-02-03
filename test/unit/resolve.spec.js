// resolve.spec.js

function resolve (basePath, nameOrDot) {
  const hasWinDrive = (path) => /^[a-zA-Z]:/.test(path)
  const isWin = basePath.includes('\\') || nameOrDot.includes('\\') || hasWinDrive(basePath) || hasWinDrive(nameOrDot)
  const sep = isWin ? '\\' : '/'
  // Handle Windows drive letters (with or without initial slash)
  if (/^[a-zA-Z]:/.test(nameOrDot)) {
    return nameOrDot.replace(/^\//, '').replace(/\//g, sep)
  }
  // Handle absolute paths
  if (nameOrDot.startsWith('/')) {
    return nameOrDot.replace(/\\/g, sep)
  }
  if (nameOrDot === '..') {
    const parts = basePath.split(sep)
    if (parts.length > 1) {
      parts.pop()
      return isWin && parts.length === 1 ? '/' : parts.join(sep) || '/'
    }
    return '/'
  }
  const result = basePath.endsWith(sep) ? basePath + nameOrDot : basePath + sep + nameOrDot
  return isWin && result.length === 3 && result.endsWith(':\\') ? '/' : result
}
// Test function
function runTests () {
  const tests = [
    // Unix-like paths
    { args: ['/foo/bar', 'baz'], expected: '/foo/bar/baz' },
    { args: ['/foo/bar/', 'baz'], expected: '/foo/bar/baz' },
    { args: ['/foo/bar', '..'], expected: '/foo' },
    { args: ['/foo', '..'], expected: '/' },
    { args: ['/', '..'], expected: '/' },
    { args: ['/', 'foo'], expected: '/foo' },

    // Windows-like paths
    { args: ['C:\\foo\\bar', 'baz'], expected: 'C:\\foo\\bar\\baz' },
    { args: ['C:\\foo\\bar\\', 'baz'], expected: 'C:\\foo\\bar\\baz' },
    { args: ['C:\\foo\\bar', '..'], expected: 'C:\\foo' },
    { args: ['C:\\foo', '..'], expected: '/' },
    { args: ['C:\\', '..'], expected: '/' },
    { args: ['C:\\', 'foo'], expected: 'C:\\foo' },
    { args: ['C:', 'foo'], expected: 'C:\\foo' },

    // Absolute paths in nameOrDot
    { args: ['/', 'C:\\'], expected: 'C:\\' },
    { args: ['/', 'C:'], expected: 'C:' },
    { args: ['/foo', 'C:\\bar'], expected: 'C:\\bar' },
    { args: ['C:\\foo', '/bar'], expected: '/bar' },
    { args: ['/', '/foo'], expected: '/foo' },

    // Edge cases
    { args: ['C:\\', 'foo'], expected: 'C:\\foo' },
    { args: ['D:\\', '..'], expected: '/' }
  ]

  let passedCount = 0
  let failedCount = 0

  tests.forEach((test, index) => {
    const result = resolve(...test.args)
    if (result === test.expected) {
      console.log(`Test ${index + 1} passed: ${test.args} => ${result}`)
      passedCount++
    } else {
      console.error(`Test ${index + 1} failed: ${test.args} => ${result} (expected ${test.expected})`)
      failedCount++
    }
  })

  console.log(`\nTotal tests: ${tests.length}`)
  console.log(`Passed: ${passedCount}`)
  console.log(`Failed: ${failedCount}`)
}

// Run the tests
runTests()

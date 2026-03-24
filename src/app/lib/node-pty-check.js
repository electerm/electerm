const { existsSync } = require('fs')
const { dirname, join } = require('path')
const {
  isWin
} = require('../common/runtime-constants')

function resolveNodePtyRoot () {
  try {
    const pkgPath = require.resolve('node-pty/package.json')
    return dirname(pkgPath)
  } catch (error) {
    return ''
  }
}

function getBindingsPaths (root) {
  if (!root) {
    return []
  }
  if (!isWin) {
    return [
      join(root, 'build/Release/pty.node'),
      join(root, 'build/Debug/pty.node')
    ]
  }
  return [
    join(root, 'build/Release/conpty.node'),
    join(root, 'build/Release/pty.node'),
    join(root, 'build/Debug/conpty.node'),
    join(root, 'build/Debug/pty.node')
  ]
}

function getNodePtyAvailability () {
  const root = resolveNodePtyRoot()
  if (!root) {
    return {
      ok: false,
      reason: 'node-pty package is not installed'
    }
  }
  const bindingsPaths = getBindingsPaths(root)
  const hasBindings = bindingsPaths.some(path => existsSync(path))
  if (!hasBindings) {
    return {
      ok: false,
      reason: `node-pty native binding is missing (${bindingsPaths.map(path => path.split(/[\\/]/).slice(-3).join('/')).join(', ')})`
    }
  }
  try {
    require('node-pty')
    return {
      ok: true,
      reason: ''
    }
  } catch (error) {
    return {
      ok: false,
      reason: error.message
    }
  }
}

function assertNodePtyAvailable () {
  const result = getNodePtyAvailability()
  if (!result.ok) {
    throw new Error(`Local terminal is unavailable because ${result.reason}`)
  }
  return require('node-pty')
}

module.exports = {
  getNodePtyAvailability,
  assertNodePtyAvailable
}

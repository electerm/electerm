/**
 * structuredClone() for the legacy builds (#4650).
 *
 * The -legacy artifacts (linux-legacy, linux-arm-legacy, linux-arm,
 * linux-loong64-legacy, mac-10, win7-tar) pin Electron 22.3.27, whose Node is
 * 16.17, and the structuredClone global only exists from Node 17. @xterm/
 * headless 6.x calls it while building a Terminal, so on those builds turning
 * on "Save terminal log to file" killed every new tab with
 * "ReferenceError: structuredClone is not defined" before the session could
 * even start.
 *
 * v8.serialize/deserialize is the same value model structuredClone is defined
 * on (it is what Node's own implementation uses), so Dates, RegExps, Maps,
 * Sets, ArrayBuffers, typed arrays, BigInts, shared references and cycles all
 * survive the round trip, and a function or a symbol throws, as it should.
 *
 * Installed at runtime rather than injected at build time (see
 * src/build/bin/inject-polyfills.js) because it only *adds* a global that is
 * missing: a modern build never notices it, and every entry point that can
 * build a vt parser is covered - the desktop main process, electerm-web's
 * server, and the unit tests.
 */

const v8 = require('v8')

function dataCloneError (message) {
  const err = new Error(message)
  err.name = 'DataCloneError'
  return err
}

function clone (value, options) {
  const transfer = options && options.transfer
  if (transfer && transfer.length) {
    // Nothing in electerm asks for a transfer, and honouring one means
    // detaching the source buffers, which v8.serialize does not do.
    throw dataCloneError('structuredClone shim does not support transfer')
  }
  try {
    return v8.deserialize(v8.serialize(value))
  } catch (e) {
    throw dataCloneError(e.message)
  }
}

// Returns true when the shim was installed, false when the runtime already
// has a native structuredClone (which is then left untouched).
function install () {
  if (typeof globalThis.structuredClone === 'function') {
    return false
  }
  globalThis.structuredClone = clone
  return true
}

module.exports = {
  clone,
  install
}

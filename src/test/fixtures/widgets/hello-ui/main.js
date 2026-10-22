/* eslint-env node */
/**
 * Main-process half of the hello-ui widget.
 *
 * Everything exported here is reachable from the widget's own UI through
 * window.electerm.call(name, ...args) — nothing needs to be added to the app's
 * ipc.js.
 */

async function greet (name) {
  return `Hello, ${name || 'widget'}!`
}

// proves arguments and return values survive the round trip
function upper (text) {
  return String(text || '').toUpperCase()
}

module.exports = {
  greet,
  upper
}

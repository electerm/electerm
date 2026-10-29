/**
 * Launch options for the opt-in local WebGL lifecycle E2E.
 *
 * Identical to ./app-options.js except that it deliberately leaves the GPU
 * enabled: the whole point of 004.webgl-lifecycle.spec.js is to run on a real
 * GPU so xterm's addon-webgl can create a real WebGL2 context, be released when
 * a terminal is hidden, and be torn down when the context is lost. A disabled
 * GPU would fall back to SwiftShader (or fail), and every assertion in that
 * spec would be meaningless.
 *
 * Built from ./app-options.js rather than re-listing the arguments: the shared
 * helper owns the launch isolation (fresh user-data dir, NODE_TEST, the
 * explicit ELECTERM_E2E_NO_SANDBOX opt-out, Linux sandbox flags). A hand-copied
 * list drifts as soon as that helper changes -- an earlier version of this file
 * predated the user-data dir, so it launched against the developer's real
 * Electron profile (and, on macOS, a cached stale bundle).
 *
 * This helper and every other E2E launch keep the sandbox: the global default
 * is only overridden when ELECTERM_E2E_NO_SANDBOX is set explicitly.
 */
const base = require('./app-options')

module.exports = {
  ...base,
  args: base.args.filter(arg => arg !== '--disable-gpu')
}

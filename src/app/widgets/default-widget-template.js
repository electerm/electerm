/**
 * Default template for user-created widgets.
 * Copy this template when creating a new widget.
 *
 * Widget types:
 *   'once'     – runs once and returns a result (no persistent instance)
 *   'instance' – starts a long-running service; must expose start() / stop()
 */

// const { customRequire } = require('../lib/custom-require')
// Use customRequire instead of require() for packages not bundled with the app.
// Example: const axios = await customRequire('axios')

const widgetInfo = {
  name: 'My Custom Widget',
  description: 'Describe what your widget does.',
  version: '1.0.0',
  author: '',
  type: 'once', // 'once' | 'instance'
  // singleInstance: true,  // uncomment to limit to one running instance
  configs: [
    {
      name: 'message',
      type: 'string',
      default: 'Hello, electerm!',
      description: 'A message to display'
    }
  ]
}

/**
 * widgetRun is called when the user clicks "Run widget".
 *
 * For type === 'once':
 *   Return a plain object / value – it will be shown to the user.
 *
 * For type === 'instance':
 *   Return an instance object that must expose:
 *     instanceId {string}  – unique ID for this run
 *     start()  – async fn that starts the service, resolves with { msg, serverInfo }
 *     stop()   – async fn that stops the service
 *   Optionally expose extra methods callable via runWidgetFunc().
 */
function widgetRun (config) {
  const { message } = config

  // ── once widget ──────────────────────────────────────────────────────────
  return {
    success: true,
    msg: message || 'Widget ran successfully!'
  }

  // ── instance widget example (delete the 'once' block above) ─────────────
  // const uid = require('../common/uid')
  // return {
  //   instanceId: uid(),
  //   async start () {
  //     // start your service here
  //     return { msg: 'Service started', serverInfo: { url: 'http://localhost:3000' } }
  //   },
  //   async stop () {
  //     // stop your service here
  //   }
  // }
}

module.exports = { widgetInfo, widgetRun }

/**
 * The pipe that carries a widget's css to the app's own renderer.
 *
 * Deliberately not a store. The css a widget applies is a property of that
 * widget's instance (load-widget.js keeps it there, next to the manifest's
 * `styles`), and the renderer is the only place it means anything, so a
 * registry here would be the same fact kept twice — and a second copy is what
 * goes stale. A window that loads while widgets are running asks
 * getWidgetStyles and gets the same answer derived from the instances.
 *
 * `configure` is called once at host start (ipc.js) with the platform transport.
 */

let emit = () => {}

function configure (fn) {
  emit = typeof fn === 'function' ? fn : () => {}
}

// `@import` in a widget stylesheet would fetch over the network from inside the
// app document; the app's own custom-css field has the same rule.
function sanitize (css) {
  return String(css == null ? '' : css).replace(/@import/gi, '#')
}

function send (widgetId, css) {
  if (typeof widgetId !== 'string' || !widgetId) {
    throw new Error('widget css needs a widget id')
  }
  try {
    emit({ id: widgetId, css: sanitize(css) })
  } catch (e) {
    // a transport that is not ready only costs the live update: the next
    // getWidgetStyles still answers from the instances
    console.error('Failed to broadcast widget css:', e)
  }
}

module.exports = {
  configure,
  send,
  sanitize
}

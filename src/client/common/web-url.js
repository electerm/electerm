/**
 * Resolve a same-origin server path for the browser.
 *
 * The web build can be served under a sub-path (electerm-web `BASE_PATH`, e.g.
 * https://host/electerm/), which only the host knows: electerm-web injects the
 * resolver as `window.et.url()` and every absolute path the browser gets has to
 * go through it. The desktop app has no such prefix, and an older host build
 * (electerm-android / harmony fork, older electerm-web) may not have the helper
 * at all, so fall back to the bare value instead of throwing.
 *
 * @param {string} path a path starting with '/'
 * @returns {string}
 */
export function webUrl (path = '') {
  const et = window.et || {}
  if (typeof et.url === 'function') {
    return et.url(path)
  }
  return et.basePath ? `${et.basePath}${path}` : path
}

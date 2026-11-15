/**
 * The renderer half of widgets that restyle electerm.
 *
 * A widget's server script never touches a DOM (it may not require electron at
 * all, see app/widgets/require-guard.js). It calls api.css.apply(), the css is
 * kept on the running instance, and this module turns it into one
 * <style data-electerm-widget="<id>"> tag in the app document — the same thing
 * on the desktop and in a browser.
 *
 * A widget UI goes one step further and applies css itself
 * (window.electerm.css, see app/widgets/bridge.js and custom-widget-panel.jsx):
 * no node process, no manifest, no round trip.
 *
 * Two entry points for the host's own pushes:
 *   live   an ipc event per change ('widget-css'), pushed by the host
 *   boot   getWidgetStyles, derived from the running instances, for a window
 *          that loads while widgets are running
 *
 * The tag is keyed by widget id and rewritten in place, so a widget that changes
 * its stylesheet does not stack <style> tags, and Stop removes the one it owns.
 */

const DOM_ID_PREFIX = 'electerm-widget-style-'
const ATTR = 'data-electerm-widget'

// `@import` in a widget stylesheet would fetch over the network from inside the
// app document; the app's own custom-css field has the same rule.
function sanitizeCss (css) {
  return String(css == null ? '' : css).replace(/@import/gi, '#')
}

function styleElement (id) {
  return document.getElementById(DOM_ID_PREFIX + id)
}

export function applyWidgetStyle (id, css) {
  if (typeof id !== 'string' || !id) {
    return
  }
  const clean = sanitizeCss(css)
  const existing = styleElement(id)
  if (!clean.trim()) {
    if (existing) {
      existing.remove()
    }
    return
  }
  if (existing) {
    if (existing.textContent !== clean) {
      existing.textContent = clean
    }
    return
  }
  const style = document.createElement('style')
  style.id = DOM_ID_PREFIX + id
  style.setAttribute(ATTR, id)
  style.textContent = clean
  // last child of <head>: a widget stylesheet has to win over the app's own
  // rules, not the other way round
  document.head.appendChild(style)
}

export function getWidgetStyle (id) {
  const el = typeof id === 'string' ? styleElement(id) : null
  return el ? el.textContent : ''
}

export function applyWidgetStyles (styles) {
  if (!styles || typeof styles !== 'object') {
    return
  }
  Object.entries(styles).forEach(([id, css]) => applyWidgetStyle(id, css))
}

// A window that loads while widgets are running: pull the registry once.
// Desktop answers synchronously; the web app answers over its socket, so the
// result can be a promise — and a browser tab whose socket is not open yet
// throws, which is fine: the live event arrives when a widget applies
// something, and the bootstrap calls this again after login.
export function syncWidgetStyles () {
  let res
  try {
    res = window.pre.runSync('getWidgetStyles')
  } catch (e) {
    return
  }
  if (res && typeof res.then === 'function') {
    res.then(applyWidgetStyles).catch(() => {})
    return
  }
  applyWidgetStyles(res)
}

let inited = false

export function initWidgetStyleHost () {
  if (inited) {
    return
  }
  inited = true
  const { ipcOnEvent } = window.pre
  if (typeof ipcOnEvent === 'function') {
    ipcOnEvent('widget-css', (evt, payload) => {
      if (payload && payload.id) {
        applyWidgetStyle(payload.id, payload.css)
      }
    })
  }
  syncWidgetStyles()
}

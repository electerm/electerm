import { widgetTabChannel } from './widget-tab-events.js'
import { applyWidgetStyle } from './widget-style-host.js'
import { webUrl } from './web-url.js'

const mounted = new Map()

function mount ({ instanceId, widgetId, css, scripts, numbers }) {
  const path = '/api/widget-assets/' + encodeURIComponent(widgetId)
  const base = window.et.isWebApp ? webUrl(path) : `http://127.0.0.1:${window.store.config.port}${path}`
  const links = css.map(name => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = base + '/files/' + name.split('/').map(encodeURIComponent).join('/')
    document.head.appendChild(link)
    return link
  })
  const variables = Object.entries(numbers).map(([name, value]) => `--widget-${widgetId}-${name}: ${value};`)
  if (variables.length) {
    applyWidgetStyle(instanceId, `:root { ${variables.join(' ')} }`)
  }
  let frame
  let channel
  if (scripts) {
    frame = document.createElement('iframe')
    frame.hidden = true
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.src = base
    channel = widgetTabChannel()
    frame.addEventListener('load', () => channel.connect(frame), { once: true })
    document.body.appendChild(frame)
  }
  return () => {
    channel?.dispose()
    frame?.remove()
    for (const link of links) {
      link.remove()
    }
    applyWidgetStyle(instanceId, '')
    document.documentElement.removeAttribute('data-widget-' + widgetId)
  }
}

function sync (instances) {
  if (!Array.isArray(instances)) {
    return
  }
  const active = new Set(instances.map(i => i.instanceId))
  for (const [id, dispose] of mounted) {
    if (!active.has(id)) {
      dispose()
      mounted.delete(id)
    }
  }
  for (const instance of instances) {
    if (!mounted.has(instance.instanceId)) {
      mounted.set(instance.instanceId, mount(instance))
    }
    const attr = 'data-widget-' + instance.widgetId
    if (instance.tokens.length) {
      document.documentElement.setAttribute(attr, instance.tokens.join(' '))
    } else {
      document.documentElement.removeAttribute(attr)
    }
  }
}

let initialized = false
export function initWidgetAssets () {
  if (initialized) {
    return
  }
  initialized = true
  let received = false
  window.pre.ipcOnEvent('widget-assets', (_, list) => {
    received = true
    sync(list)
  })
  // Adopt instances already running when this window opened.
  try {
    const list = window.pre.runSync('getWidgetAssetInstances')
    if (list?.then) {
      list.then(items => {
        if (!received) {
          sync(items)
        }
      }).catch(() => {})
    } else {
      sync(list)
    }
  } catch (e) { /* older web hosts lack client asset support */ }
}
